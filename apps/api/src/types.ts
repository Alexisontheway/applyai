import 'hono';

declare module 'hono' {
  interface ContextVariableMap {
    user: { id: string; name: string; email: string };
    session: { id: string };
  }
}
