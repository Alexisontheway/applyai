import type { User } from '@applyai/shared/types';

declare module 'hono' {
  interface ContextVariableMap {
    user: User;
    session: { id: string };
    requestId: string;
  }
}
