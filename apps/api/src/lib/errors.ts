import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { ZodError } from 'zod';

/** An error with an HTTP status the API can hand back to the client verbatim. */
export class AppError extends Error {
  readonly status: ContentfulStatusCode;
  readonly details?: unknown;

  constructor(message: string, status: ContentfulStatusCode = 400, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.details = details;
  }

  static notFound(what = 'Resource'): AppError {
    return new AppError(`${what} not found`, 404);
  }

  static badRequest(message: string, details?: unknown): AppError {
    return new AppError(message, 400, details);
  }

  static upstream(message: string, details?: unknown): AppError {
    return new AppError(message, 502, details);
  }

  static unavailable(message: string, details?: unknown): AppError {
    return new AppError(message, 503, details);
  }
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof ZodError) {
    return new AppError('Validation failed', 400, error.flatten());
  }
  if (error instanceof Error) return new AppError(error.message, 500);
  return new AppError('Unknown error', 500);
}

/** Consistent success envelope: `{ success: true, data }`. */
export function ok<T>(c: Context, data: T, status: ContentfulStatusCode = 200) {
  return c.json({ success: true as const, data }, status);
}
