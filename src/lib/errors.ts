/**
 * Central error system (plan §26, §37).
 *
 * Every route handler throws AppError for expected failures; the central
 * handler in `src/lib/api.ts` converts any thrown value into the envelope
 * `{ success: false, error: { code, message, details? } }`.
 *
 * The child never sees a stack trace — generic messages only, logs are
 * id/count-based and PII-free.
 */

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "PAYLOAD_TOO_LARGE"
  | "DEPENDENCY_UNAVAILABLE"
  | "INTERNAL";

export interface AppErrorOptions {
  statusCode: number;
  code: ErrorCode;
  details?: unknown;
  cause?: unknown;
}

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details?: unknown;
  readonly isOperational: boolean;

  constructor(message: string, options: AppErrorOptions) {
    super(message, { cause: options.cause });
    this.name = "AppError";
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.details = options.details;
    this.isOperational = true;
  }

  static validation(message: string, details?: unknown) {
    return new AppError(message, { statusCode: 400, code: "VALIDATION_ERROR", details });
  }

  static unauthorized(message = "You need to be logged in.") {
    return new AppError(message, { statusCode: 401, code: "UNAUTHORIZED" });
  }

  static forbidden(message = "You do not have permission to do that.") {
    return new AppError(message, { statusCode: 403, code: "FORBIDDEN" });
  }

  static notFound(message = "Not found.") {
    return new AppError(message, { statusCode: 404, code: "NOT_FOUND" });
  }

  static conflict(message: string) {
    return new AppError(message, { statusCode: 409, code: "CONFLICT" });
  }

  static rateLimited(message = "Too many requests. Please try again later.") {
    return new AppError(message, { statusCode: 429, code: "RATE_LIMITED" });
  }

  static dependencyUnavailable(message = "A required service is unavailable right now.") {
    return new AppError(message, {
      statusCode: 503,
      code: "DEPENDENCY_UNAVAILABLE",
    });
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

interface SafeErrorBody {
  code: ErrorCode;
  message: string;
  details?: unknown;
}

/**
 * Converts any thrown value into a safe, client-facing error body.
 * Unknown/internal errors get a generic message (child-safe, plan §37);
 * operational details are logged separately (never returned).
 */
export function toErrorBody(error: unknown): SafeErrorBody {
  if (isAppError(error)) {
    return { code: error.code, message: error.message, details: error.details };
  }

  if (error && typeof error === "object") {
    const e = error as Record<string, unknown>;

    // Mongoose validation failure → 400 with field errors (no internal detail).
    if (e.name === "ValidationError" && typeof e.message === "string") {
      return {
        code: "VALIDATION_ERROR",
        message: e.message,
        details: extractMongooseFieldErrors(e),
      };
    }

    // Mongoose cast error (bad ObjectId, wrong type) → 400.
    if (e.name === "CastError") {
      return { code: "VALIDATION_ERROR", message: "One of the values provided is invalid." };
    }

    // Duplicate key → 409.
    if (e.code === 11000) {
      return { code: "CONFLICT", message: "That record already exists." };
    }

    // JSON parse failures from request bodies.
    if (e instanceof SyntaxError) {
      return { code: "VALIDATION_ERROR", message: "The request body is not valid JSON." };
    }
  }

  // Unknown/unexpected — log with a correlation id; never leak internals.
  const correlationId = randomCorrelationId();
  console.error(`[error] correlation=${correlationId}`, error);
  return {
    code: "INTERNAL",
    message: "Something went wrong. Please try again in a moment.",
    details: process.env.NODE_ENV === "development" ? { correlationId } : undefined,
  };
}

function extractMongooseFieldErrors(e: Record<string, unknown>): Record<string, string> {
  const errors = e.errors;
  if (!errors || typeof errors !== "object") return {};
  const out: Record<string, string> = {};
  for (const [field, value] of Object.entries(errors as Record<string, { message?: string }>)) {
    out[field] = value?.message ?? "Invalid value.";
  }
  return out;
}

function randomCorrelationId(): string {
  return `err-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
