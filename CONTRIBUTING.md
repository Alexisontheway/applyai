# Contributing to ApplyAI

## How to Contribute

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

## Development

```bash
npm install            # install all workspace dependencies
npm run dev            # start API + web concurrently
npm run lint           # biome lint
npm run lint:fix       # auto-fix lint issues
npm run typecheck      # TypeScript type check all packages
```

## Project Conventions

- **TypeScript** — strict mode, no `any`
- **Formatting** — Biome (2-space indent, single quotes, trailing commas)
- **Commits** — Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`)
- **Zod first** — all data shapes defined as Zod schemas in `packages/shared`
- **Hono pattern** — route files in `apps/api/src/routes/` with auth middleware
- **TanStack Query** — all data fetching through custom hooks in `apps/web/src/lib/queries.ts`

## Architecture Notes

- The `shared` package is the single source of truth — Zod schemas generate TypeScript types consumed by both API and web
- Hono is runtime-agnostic — the same code runs on Node.js, Bun, Deno, or Cloudflare Workers
- The Python ML service communicates via HTTP — no tight coupling
