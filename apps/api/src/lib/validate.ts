import { zValidator } from '@hono/zod-validator';
import type { ValidationTargets } from 'hono';
import type { ZodSchema } from 'zod';

/**
 * zValidator with our API error envelope, so a bad request looks exactly like
 * every other error the client has to handle.
 */
export function validate<T extends ZodSchema, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T,
) {
  return zValidator(target, schema, (result, c) => {
    if (result.success) return;
    const issues = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    return c.json(
      {
        success: false as const,
        error: issues[0]
          ? `${issues[0].path ? `${issues[0].path}: ` : ''}${issues[0].message}`
          : 'Validation failed',
        details: issues,
      },
      400,
    );
  });
}
