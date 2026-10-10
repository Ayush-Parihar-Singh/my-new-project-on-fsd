// Client-side helper for calling our Route Handlers. Returns a discriminated result, never throws.
export type ApiResult<T> = { ok: true; data: T; status: number } | { ok: false; status: number; code: string; message: string; fieldErrors?: Record<string, string[]> };

export async function api<T = unknown>(method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", url: string, body?: unknown): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
    });
  } catch {
    return { ok: false, status: 0, code: "NETWORK", message: "We could not reach LastPlate. Check your connection and try again." };
  }
  const payload = (await res.json().catch(() => null)) as
    | { error?: { code?: string; message?: string; details?: { fieldErrors?: Record<string, string[]> } & Record<string, unknown> } }
    | T
    | null;
  if (!res.ok) {
    const err = (payload as { error?: { code?: string; message?: string; details?: Record<string, unknown> } } | null)?.error;
    return {
      ok: false,
      status: res.status,
      code: err?.code ?? "ERROR",
      message: err?.message ?? "Something went wrong. Please try again.",
      fieldErrors: (err as { details?: { fieldErrors?: Record<string, string[]> } } | undefined)?.details?.fieldErrors,
    };
  }
  return { ok: true, data: payload as T, status: res.status };
}
