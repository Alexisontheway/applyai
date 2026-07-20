import { serve } from '@hono/node-server';
import app from './app';

const port = Number(process.env.PORT) || 4000;

serve({ fetch: app.fetch, port }, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║   ApplyAI API                            ║
  ║   Running on http://localhost:${port}        ║
  ║   Environment: ${(process.env.NODE_ENV || 'development').padEnd(22)}║
  ╚══════════════════════════════════════════╝
  `);
});
