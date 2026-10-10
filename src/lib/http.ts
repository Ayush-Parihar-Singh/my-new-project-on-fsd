// HTTP helpers for Route Handlers: consistent JSON envelopes and centralized error mapping.
import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type z } from "zod";
import { AppError, BadRequestError, ValidationError, type FieldErrors } from "./errors";
import { logger } from "./logger";

export function json<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function zodFieldErrors(error: ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    out[key] = [...(out[key] ?? []), issue.message];
  }
  return out;
}

export function errorResponse(error: unknown, requestId?: string): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } },
      { status: error.status, headers: { "Cache-Control": "no-store", ...(error.status === 429 ? retryHeader(error) : {}) } },
    );
  }
  if (error instanceof ZodError) {
    const fieldErrors = zodFieldErrors(error);
    const v = new ValidationError(fieldErrors);
    return errorResponse(v, requestId);
  }
  // Prisma unique-constraint violations surface as P2002; never leak internals.
  if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002") {
    return errorResponse(new AppError("That value is already in use.", 409, "DUPLICATE"), requestId);
  }
  const id = requestId ?? crypto.randomUUID();
  logger.error("unhandled_error", { requestId: id, name: (error as Error)?.name, message: (error as Error)?.message });
  return NextResponse.json(
    { error: { code: "INTERNAL", message: "Something went wrong on our side. Please try again.", requestId: id } },
    { status: 500, headers: { "Cache-Control": "no-store" } },
  );
}

function retryHeader(error: AppError): Record<string, string> {
  const seconds = (error.details?.retryAfterSeconds as number | undefined) ?? 60;
  return { "Retry-After": String(seconds) };
}

type Handler<P> = (req: NextRequest, ctx: { params: Promise<P> }) => Promise<Response>;

/** Wraps a Route Handler so every thrown error becomes a safe JSON response. */
export function apiRoute<P = Record<string, string>>(handler: Handler<P>) {
  return async (req: NextRequest, ctx: { params: Promise<P> }): Promise<Response> => {
    try {
      return await handler(req, ctx);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export async function readJson<S extends z.ZodType>(req: NextRequest, schema: S): Promise<z.output<S>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new BadRequestError("The request body must be valid JSON.");
  }
  const result = schema.safeParse(body);
  if (!result.success) throw new ValidationError(zodFieldErrors(result.error));
  return result.data as z.output<S>;
}

export function clientIp(req: NextRequest): string {
  // Behind a trusted reverse proxy, the first X-Forwarded-For hop is the client.
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim().slice(0, 64);
  return req.headers.get("x-real-ip")?.slice(0, 64) ?? "unknown";
}

export function parseQuery<S extends z.ZodType>(req: NextRequest, schema: S): z.output<S> {
  const result = schema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
  if (!result.success) throw new ValidationError(zodFieldErrors(result.error));
  return result.data as z.output<S>;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function paginate<T>(items: T[], total: number, page: number, pageSize: number): Paginated<T> {
  return { items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
