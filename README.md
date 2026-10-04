<p align="center">
  <div style="width:64px;height:64px;background:#EAFF00;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:28px;color:#000;margin:0 auto 16px;font-family:monospace">A</div>
  <h1 align="center">ApplyAI</h1>
  <p align="center"><strong>Job-search co-pilot. Track, match and optimise every application — from discovery to offer.</strong></p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/Hono-4-FF6600?style=flat-square&logo=hono&logoColor=white" alt="Hono 4" />
  <img src="https://img.shields.io/badge/Drizzle-ORM-7B1FA2?style=flat-square&logo=drizzle&logoColor=white" alt="Drizzle ORM" />
  <img src="https://img.shields.io/badge/Node.js-22-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/PostgreSQL-17-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
</p>

---

## What it actually does

Every claim below is implemented and tested in this repository. The optional
extras degrade gracefully: you can run the whole product with nothing but Node
and Postgres.

| Feature | Status | What it really does |
|---|---|---|
| **Pipeline Kanban** | live | Drag applications through Saved → Applied → Screening → Interview → Offer → Rejected → Ghosted. Every move is recorded as an event and feeds the analytics. |
| **Resume manager** | live | Paste text or upload PDF/DOCX (upload needs the optional ML service). Each resume stores its extracted skill list; mark one active; see which version earns interviews. |
| **Match engine** | live, local | Weights required skills 60%, keyword relevance 25% and (when available) embeddings 15%. Returns matched skills, gaps and written suggestions. No API keys, no network, ~5 ms per pair. |
| **Job discovery** | live | Queries public job APIs in parallel: Greenhouse, Lever and Ashby company boards plus Remotive, RemoteOK and Arbeitnow. Preview a match score for every result and track it in one click. |
| **Company intel** | live, derived | Company records are built from the jobs you track: application counts, interviews, average match score, tech stack and your own notes. No scraping, no third-party profile data. |
| **Cover letters** | live, local | Generates a grounded letter from the resume + posting + matched skills. Uses Ollama if you have it, otherwise a deterministic template engine — either way it names real experience, it does not invent any. |
| **Analytics** | live | Funnel, response/interview/offer rates, time-to-first-response, source ROI, per-resume performance and which skills your target postings keep asking for. Computed in SQL, not in the browser. |
| **Semantic matching** | optional | With the ML service and `sentence-transformers` installed, an embedding signal joins the blend. Without it the score works exactly the same, just without that signal. |
| **PDF/DOCX parsing** | optional | Needs the ML service. Plain text always works. |

> **Not in here:** LinkedIn/Indeed scraping, Glassdoor/funding enrichment, OAuth
> providers, email sync. Those are deliberately out of scope — see
> [`docs/ANALYSIS.md`](docs/ANALYSIS.md) for why and what to do instead.

---

## Quick start

```bash
git clone https://github.com/Alexisontheway/applyai && cd applyai
npm install
npm run setup     # creates apps/api/.env, starts Postgres, pushes schema, seeds demo data
npm run dev       # API on :4000, web on :5173
```

Open <http://localhost:5173> and sign in with **demo@applyai.dev / demo1234**.

`npm run setup` starts a real Postgres from the `embedded-postgres` binaries —
no Docker, no cloud account. To use your own database instead, put its URL in
`apps/api/.env` (`DATABASE_URL=...`) and run `npm run db:push && npm run db:seed`.

| Command | What it does |
|---|---|
| `npm run dev` | API + web with hot reload (`npm run dev:full` also manages the local DB) |
| `npm run dev:ml` | Optional Python service for embeddings + PDF/DOCX parsing |
| `npm run db:local` / `db:local:stop` / `db:local:status` | Manage the embedded Postgres |
| `npm run db:push` / `db:generate` / `db:seed` / `db:studio` | Schema + demo data |
| `npm run check` | Typecheck + lint + all tests |
| `npm test` | Vitest for shared/API/web (`npm run test:ml` for the Python service) |
| `npm run smoke` | Walks the live API end to end with a real session; exits non-zero on failure |

---

## Architecture

```
                       ┌──────────────────────────────────────────────┐
   browser  ──────────▶│ web  React 19 · Vite 6 · TanStack Router      │
                       │      Query cache · optimistic updates         │
                       └───────────────┬──────────────────────────────┘
                                       │ /api/*  (same origin in prod,
                                       │          Vite proxy in dev)
                       ┌───────────────▼──────────────────────────────┐
                       │ api  Hono on Node 22                          │
                       │  auth ─ better-auth (email + password)        │
                       │  routes ─ jobs · applications · resumes ·     │
                       │           discovery · companies · analytics   │
                       │  services ─ application · discovery ·         │
                       │             analytics · cover-letter          │
                       │  match ─ taxonomy + TF-IDF + optional semantic│
                       │  db ─ Drizzle ORM                             │
                       └───────┬───────────────────────┬──────────────┘
                               │                       │ optional HTTP
                  ┌────────────▼──────────┐   ┌────────▼─────────────────┐
                  │ PostgreSQL             │   │ ml-service (FastAPI)     │
                  │ 11 tables, SQL         │   │  embeddings (optional)   │
                  │ analytics in SQL       │   │  PDF/DOCX parsing        │
                  └────────────────────────┘   │  Ollama proxy (optional) │
                                               └──────────────────────────┘
                       ┌──────────────────────────────────────────────┐
                       │ public job APIs (no keys, no scraping)        │
                       │ Greenhouse · Lever · Ashby · Remotive ·       │
                       │ RemoteOK · Arbeitnow                          │
                       └──────────────────────────────────────────────┘
```

Request path for the interesting case — *"add this job and tell me how well I
fit"*:

1. `POST /api/jobs/track` validates the payload with the shared Zod schema.
2. The job is upserted (deduplicated by URL) and an application row is created.
3. `computeMatch()` analyses the posting (sections, required vs nice-to-have
   skills), extracts the resume's skills, and blends the three signals.
4. The result is stored in `match_results` and an `application_events` row is
   written, which is what the dashboard timeline shows.
5. The client invalidates `applications`, `dashboard` and `analytics` queries —
   TanStack Query refetches only what is on screen.

The score is explainable by construction: every number in the breakdown comes
from a named signal, and every gap is a skill the parser actually found in the
posting.

---

## Configuration

`apps/api/.env` (created by `npm run setup`) — the essentials:

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_URL` | embedded Postgres on `:5433` | Any Postgres works: Supabase, Neon, RDS, Docker |
| `BETTER_AUTH_SECRET` | generated | Required in production (32+ chars) |
| `BETTER_AUTH_URL` | `http://localhost:4000` | Public URL of the API |
| `CLIENT_URL` / `TRUSTED_ORIGINS` | `http://localhost:5173` | Origins allowed to call the API with cookies |
| `PORT` | `4000` | API port |

Optional:

| Variable | Effect when set |
|---|---|
| `ML_SERVICE_URL` | Enables embeddings + PDF/DOCX parsing (default `http://localhost:5000`) |
| `OLLAMA_URL`, `OLLAMA_MODEL` | Cover letters are written by your local model instead of the template engine |
| `GREENHOUSE_BOARDS`, `LEVER_COMPANIES`, `ASHBY_BOARDS` | Which company boards Job Scout searches (comma-separated slugs) |
| `DISABLED_JOB_SOURCES` | Turn individual sources off |
| `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS` | In-memory rate limiting per IP |

---

## The optional ML service

```bash
cd ml-service
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt   # seconds, no GPU
.venv/bin/uvicorn src.main:app --host 0.0.0.0 --port 5000
```

It exposes exactly three things: `/health`, `/match` (embedding similarity) and
`/parse-resume` (PDF/DOCX → text). Everything it reports about itself is shown
in the sidebar, including when embeddings are unavailable:

```
Embeddings off  →  "sentence-transformers is not installed. The API keeps
                    working without it."   (PDF parsing still works)
```

Add embeddings (~2 GB of torch) with `.venv/bin/pip install -r requirements-embeddings.txt`.
Tests: `cd ml-service && .venv/bin/python -m pytest`.

---

## Project layout

```
applyai/
├── apps/
│   ├── api/                 Hono API, Drizzle schema, matching engine
│   │   ├── src/match/       skills taxonomy · TF-IDF · score blend (unit tested)
│   │   ├── src/discovery/   public job-API providers, URL importer
│   │   ├── src/routes/      HTTP surface (one file per resource)
│   │   ├── src/services/    business logic (applications, analytics, letters)
│   │   └── db/migrations/   generated SQL migrations
│   └── web/                 React client
│       ├── src/pages/       Dashboard · Pipeline · Applications · Job Scout ·
│       │                    Resumes · Companies · Analytics · Login
│       ├── src/components/  app shell, drawers, match panel, primitives
│       ├── src/lib/         api client, query hooks, formatters
│       └── src/test/        route-level smoke tests against canned API data
├── packages/shared/         Zod schemas + types shared by both apps
├── ml-service/              optional FastAPI service (embeddings, parsing)
└── scripts/                 setup, embedded Postgres, demo seed
```

---

## Testing

```
packages/shared   12 tests   schema contracts (statuses, defaults, bounds)
apps/api          35 tests   matching engine, discovery normalisation, importer
apps/web          11 tests   every page renders real API shapes; sign-in journey
ml-service        12 tests   /health, /match, /parse-resume (the regression that
                             shipped a 500 on every upload)
```

`npm run check` runs typecheck + Biome + the Vitest suites. The web tests render
the real route tree against canned responses recorded from the API, so a change
in a response shape fails the build instead of the browser.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Database is not reachable` in the API log | `npm run db:local` (or point `DATABASE_URL` somewhere real), then `npm run db:push` |
| Sign-in returns `Invalid origin` | Add the origin you are browsing from to `TRUSTED_ORIGINS` in `apps/api/.env` |
| Job Scout finds 0 jobs | The public APIs are unreachable from your network, or every requested board 404s — the UI lists each provider's error |
| `PDF/DOCX parsing needs the ML service` | `npm run dev:ml`, or paste the resume text (always supported) |
| Sidebar shows `ML (parsing only)` | The service is up but `sentence-transformers` is not installed — semantic matching falls back to keyword scoring |

---

## License

MIT — see [LICENSE](LICENSE).
