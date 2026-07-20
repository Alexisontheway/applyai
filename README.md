<p align="center">
  <div style="width:64px;height:64px;background:#EAFF00;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:28px;color:#000;margin:0 auto 16px;font-family:monospace">A</div>
  <h1 align="center">ApplyAI</h1>
  <p align="center"><strong>AI-powered job search co-pilot. Track, match, and optimize your applications — from discovery to offer.</strong></p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/Hono-4-FF6600?style=flat-square&logo=hono&logoColor=white" alt="Hono 4" />
  <img src="https://img.shields.io/badge/Drizzle-ORM-7B1FA2?style=flat-square&logo=drizzle&logoColor=white" alt="Drizzle ORM" />
  <img src="https://img.shields.io/badge/Node.js-22-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Supabase-Free-3FCF8E?style=flat-square&logo=supabase&logoColor=white" alt="Supabase" />
</p>

---

## What It Does

Applying to jobs is a manual grind — tailor resumes, write cover letters, track spreadsheets, zero visibility into what's working. ApplyAI turns your job search into a data-driven campaign.

| Feature | What It Solves |
|---|---|
| **Pipeline Kanban** | Drag applications through 7 stages: Saved → Applied → Screening → Interview → Offer → Rejected → Ghosted |
| **Resume Manager** | Upload versions, tag them ("SWE General", "ML Focus"), mark active — know which resume got you each interview |
| **ML Matcher** | Paste a JD, get a semantic match score against your resume using Sentence Transformers (not keyword counting) |
| **OSINT Engine** | Scrapes LinkedIn, Indeed, Naukri, and company career pages — jobs come to you |
| **Company Intel** | Auto-builds profiles: tech stack, Glassdoor rating, funding, hiring manager |
| **Cover Letter Generator** | Local LLM (Ollama) drafts tailored cover letters — zero API cost, private |
| **Analytics** | Funnel metrics, board ROI, response time, best-performing resume |

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| **Runtime** | Node.js 22 LTS | Runs on every cloud provider. No platform lock-in |
| **API** | Hono 4 | 70k req/s on Node, 4x faster than Express. Runtime-agnostic |
| **ORM** | Drizzle ORM | Type-safe SQL. Still write `SELECT * FROM` but get TypeScript types |
| **Validation** | Zod 3 | Runtime validation + TypeScript types from one schema |
| **Client** | React 19 + Vite 6 + TanStack Router | Type-safe routes, loaders, search params |
| **Server State** | TanStack Query | Auto-caching, dedup, optimistic updates |
| **UI** | shadcn/ui + Tailwind CSS v4 | Copy-paste, own the code. Radix accessible primitives |
| **Auth** | Better Auth | Email + Google OAuth. Open source, free |
| **DB** | Supabase (PostgreSQL) | Free tier: 500MB DB, auth, file storage, real-time |
| **ML** | FastAPI + Sentence Transformers | Semantic understanding > TF-IDF keyword matching |
| **LLM** | Ollama (local) | Run Llama 3, Mistral, Phi-4 locally. $0 API cost |
| **Scraping** | Playwright | Faster than Puppeteer. Handles JS-heavy sites |
| **Linting** | Biome | Rust-based. 10x faster than ESLint + Prettier |

---

## Project Structure

```
applyai/
├── apps/
│   ├── api/                 # Hono API server
│   │   ├── src/
│   │   │   ├── routes/      # jobs, applications, resumes
│   │   │   ├── middleware/   # auth, rate-limit
│   │   │   ├── db/          # Drizzle schema + client
│   │   │   ├── app.ts       # Hono app setup
│   │   │   └── index.ts     # Server entry
│   │   └── drizzle.config.ts
│   │
│   └── web/                 # React + Vite client
│       ├── src/
│       │   ├── pages/       # Dashboard, Pipeline, JobScout, Analytics, Resumes, Login
│       │   ├── components/  # RootLayout, shadcn/ui components
│       │   ├── lib/         # auth client, API client, utilities
│       │   ├── router.tsx   # TanStack Router config
│       │   └── main.tsx
│       └── vite.config.ts
│
├── packages/
│   └── shared/              # Zod schemas + TypeScript types
│
├── ml-service/              # Python FastAPI microservice
│   ├── src/
│   │   ├── main.py          # API endpoints
│   │   ├── matcher.py       # Sentence Transformers matcher
│   │   └── scraper.py       # Playwright scrapers
│   ├── Dockerfile
│   └── requirements.txt
│
├── docker-compose.yml       # Spin up all 3 services
└── biome.json               # Linter + formatter (replaces ESLint/Prettier)
```

---

## Getting Started

### Prerequisites

- **Node.js 22+** and npm
- **Supabase account** — free tier at [supabase.com](https://supabase.com)
- **Ollama** (optional, for cover letter generation) — [ollama.com](https://ollama.com)

### 1 — Set Up Supabase

1. Go to [supabase.com](https://supabase.com) → **Start a project**
2. In project dashboard → **Project Settings** → **Database** → copy connection string
3. Enable **Auth** → add email/password provider (Google OAuth optional)

### 2 — Configure Environment

```bash
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env`:

```env
DATABASE_URL=postgresql://postgres.xxxx:password@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
BETTER_AUTH_SECRET=<random-32-char-string>
BETTER_AUTH_URL=http://localhost:4000
CLIENT_URL=http://localhost:5173
```

### 3 — Install & Migrate

```bash
# Install all dependencies (npm workspaces)
npm install

# Push Drizzle schema to Supabase
npm run db:push
```

### 4 — Start Development

```bash
# Start API + Web concurrently
npm run dev

# Or individually:
npm run dev:api    # → http://localhost:4000
npm run dev:web    # → http://localhost:5173
```

---

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | — | Register with email + password |
| `POST` | `/api/auth/login` | — | Sign in |
| `GET` | `/api/health` | — | Health check |
| `GET` | `/api/jobs` | Required | List user's jobs |
| `POST` | `/api/jobs` | Required | Create job |
| `GET` | `/api/jobs/:id` | Required | Get job details |
| `DELETE` | `/api/jobs/:id` | Required | Delete job |
| `GET` | `/api/applications` | Required | List applications (with joined job data) |
| `POST` | `/api/applications` | Required | Create application |
| `PATCH` | `/api/applications/:id` | Required | Update status/notes |
| `GET` | `/api/resumes` | Required | List user's resumes |
| `POST` | `/api/resumes` | Required | Upload resume metadata |

ML endpoints (once deployed):

| Method | Path | Description |
|---|---|---|
| `POST` | `/match` | Resume-JD semantic matching |
| `POST` | `/extract-skills` | Extract skills from JD text |
| `POST` | `/gap-analysis` | Resume vs JD gap analysis |
| `POST` | `/cover-letter` | Generate cover letter (Ollama) |
| `POST` | `/scrape-job` | Scrape job from URL (Playwright) |

---

## Build Phases

| Phase | What | Status |
|---|---|---|
| **1 — Auth + Foundation** | Login, register, monorepo, shared types, Drizzle schema | ✅ Complete |
| **2 — Manual Pipeline** | Kanban board, manual job entry, status tracking | ✅ Complete |
| **3 — Resume Manager** | Upload, version tagging, Supabase Storage | ✅ Scaffolded |
| **4 — ML Matcher** | Sentence Transformers semantic scoring | ✅ Scaffolded |
| **5 — OSINT Engine** | Playwright scrapers for job boards | ✅ Scaffolded |
| **6 — Analytics** | Recharts dashboards, funnel metrics | ✅ Scaffolded |
| **7 — Automation** | Ollama cover letters, follow-up reminders, email campaigns | 🚧 Planned |

---

## Running Anywhere

This stack deploys to any Node.js-compatible platform:

| Platform | How |
|---|---|
| **Vercel** | `apps/web` as frontend, `apps/api` as serverless functions |
| **Render** | Web service for API, static site for web |
| **Railway** | Monorepo template, add Postgres plugin |
| **Fly.io** | Dockerfile for API, static for web |
| **AWS Lambda** | Hono has Lambda adapter built-in |
| **Any VPS** | `docker-compose up` |

The Python ML service deploys separately via Docker (Fly.io, Railway, Render).

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## License

[MIT](./LICENSE) © 2026 Priyanshu Pramanik
