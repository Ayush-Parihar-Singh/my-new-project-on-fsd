// Centralised application errors. Route handlers translate these into HTTP responses
// via `handleRouteError` in src/lib/http.ts. Messages are safe to show to end users.

export type FieldErrors = Record<string, string[]>;

export class AppError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class BadRequestError extends AppError {
  constructor(message = "The request could not be processed.", details?: Record<string, unknown>) {
    super(message, 400, "BAD_REQUEST", details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Please sign in to continue.") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to do this.") {
    super(message, 403, "FORBIDDEN");
  }
}

export class NotFoundError extends AppError {
  constructor(message = "We could not find that item.") {
    super(message, 404, "NOT_FOUND");
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code = "CONFLICT", details?: Record<string, unknown>) {
    super(message, 409, code, details);
  }
}

export class RuleViolationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 422, "RULE_VIOLATION", details);
  }
}

export class ValidationError extends AppError {
  constructor(public readonly fieldErrors: FieldErrors, message = "Please correct the highlighted fields.") {
    super(message, 422, "VALIDATION_FAILED", { fieldErrors });
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfterSeconds: number) {
    super("Too many attempts. Please wait a few minutes and try again.", 429, "RATE_LIMITED", {
      retryAfterSeconds,
    });
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = "This feature is temporarily unavailable.") {
    super(message, 503, "SERVICE_UNAVAILABLE");
  }
}
