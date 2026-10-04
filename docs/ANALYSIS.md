# ApplyAI — what it is, what was wrong, and what changed

This document is the audit of the project as it was handed over: the idea, the
architecture, the gap between what the README promised and what the code did,
and the record of what was fixed. It is written to be read by a human who wants
to *own* this codebase — no marketing.

---

## 1. The idea, honestly assessed

**What it is.** A private, self-hosted job-search CRM with a matching engine.
You keep every application in one pipeline, every resume version in one place,
and the tool tells you how well you fit each posting *and why* — which skills
the posting asks for, which ones your resume does not show, and how your search
is actually converting (response rate, interview rate, best resume, best source).

**Why it is a good idea.**

- The pain is real and repeated: a serious search is 50–300 applications with
  resume variants, cover letters, follow-ups and no feedback loop.
- The differentiating piece is not "AI writes your cover letter" — it is the
  *feedback loop*: score → track → measure → adjust. Generic AI writing tools
  do not close that loop; a spreadsheet does not compute it.
- Matching that explains itself ("Kubernetes appears 3× in the requirements and
  not in your resume") is more useful than a black-box similarity number, and it
  does not require sending your resume to a third party.

**Where the idea is weaker.**

- **Data moat.** Everything here is derived from data you already have. There is
  no proprietary dataset, so the moat is execution and trust, not information.
- **Cover letters are table stakes.** Every assistant writes them. Here the
  honest version (grounded in your real experience, template fallback) is
  correct but not a reason to switch.
- **Discovery is commodity.** Public job APIs are open to everyone; Job Scout is
  convenient, not defensible.
- **Switching cost is low.** The product has to earn its place every week of the
  search. That is why analytics and the follow-up queue matter more than the
  chat features.

Conclusion: a genuinely useful personal tool with one defensible strength
(explainable matching + measurement). It is not a venture-scale product, and it
does not need to be. See §6 for what would make it stronger.

---

## 2. How it is built

**Shape.** A three-process monorepo with a hard split between "must work" and
"nice to have":

| Piece | Must work? | Responsibility |
|---|---|---|
| `apps/api` (Hono + Drizzle + Postgres) | yes | Auth, persistence, matching, discovery, analytics, cover letters |
| `apps/web` (React 19 + TanStack Router/Query) | yes | UI, optimistic updates, client cache |
| `packages/shared` (Zod) | yes | One schema for both sides — statuses, defaults, bounds |
| `ml-service` (FastAPI) | no | Embeddings + PDF/DOCX parsing only |
| Ollama | no | Optional LLM for cover letters |

The deliberate design decision is that **the product is complete without the
optional Python service**. Matching is a local engine; parsing falls back to
paste; letters fall back to a template. Optional services *add* signal and are
never required to boot.

**Data model (11 tables).** `users/session/account/verification` (better-auth),
`companies`, `jobs`, `applications`, `application_events`, `resumes`,
`match_results`, `cover_letters`. Two design points worth knowing:

- `application_events` is an append-only log. Status changes write an event, and
  the dashboard timeline and "days in stage" analytics read from it. That is why
  the pipeline is not just a status column.
- `match_results` stores the full explanation (matched skills, gaps, breakdown
  weights, suggestions), so history is inspectable when the engine changes.

**The matching engine** (`apps/api/src/match/`) is the piece worth understanding:

1. `skills.ts` — a curated taxonomy of ~200 skills with aliases, matched with
   word-boundary regexes (`\p{L}`, `u` flag). This is what prevents "Java"
   matching "JavaScript".
2. `score.ts` — splits the posting into sections (requirements / nice-to-have /
   responsibilities / prose) and weights skills accordingly; blends
   `0.60·skillCoverage + 0.25·keywordRelevance + 0.15·semanticSimilarity`.
   When embeddings are unavailable, that 15% is redistributed, never zeroed —
   the score stays comparable across configurations.
3. `similarity.ts` — TF-IDF cosine, calibrated so it lands on the same scale as
   the embedding cosine.
4. Output is an explanation, not a number: matched skills (with the sentence
   they appear in), gaps weighted by section, and written suggestions.

**Discovery** (`apps/api/src/discovery/`) queries public APIs — Greenhouse,
Lever and Ashby company boards plus Remotive, RemoteOK and Arbeitnow — in
parallel with per-provider timeouts, one retry, a 4 MB response cap, and
SSRF-guarded URL importing. Provider failures are isolated and *surfaced in the
UI per source* rather than hidden.

---

## 3. README vs reality (before this work)

The README described a product that did not exist. This table is the honest
version — it is also the list of things to avoid claiming again.

| README claim | Reality in the code |
|---|---|
| "ML Matcher … using Sentence Transformers (not keyword counting)" | The shipped engine is a skill taxonomy + TF-IDF blend. Embeddings are optional and were not installed. |
| "OSINT Engine — scrapes LinkedIn, Indeed, Naukri and career pages" | No such scraper existed in the working tree; the deleted `scraper.py` targeted sites that forbid it and would have been blocked instantly. |
| "Company Intel — Glassdoor rating, funding, hiring manager" | Company rows are derived from jobs you track, plus your own notes. No external enrichment. |
| "Auth — Email + Google OAuth" | Email + password only. |
| "shadcn/ui + Radix primitives" | Hand-rolled Tailwind components; no shadcn dependency. |
| "Supabase" as a requirement | Any Postgres works; the default is an embedded one so no account is needed. |
| "Playwright scraping" | Not used anywhere. |

---

## 4. What was actually broken

Ordered by how much of the product it blocked. Every item was reproduced before
it was fixed, and each has a test or a recorded probe behind it.

### 4.1 You could not log in at all — every `/api/auth/*` call 404'd

- **Symptom:** `POST /api/auth/sign-in/email` → `{"success":false,"error":"No route for POST /api/auth/sign-in/email"}`; the UI bounced straight back to the login screen.
- **Cause:** the auth wildcard was registered as `app.on(['POST','GET'], '/api/auth/**', …)`. In Hono's router that pattern never matched once the full route table was registered (it does match in a minimal app — which is why it survived review).
- **Fix:** `app.all('/api/auth/*', (c) => auth.handler(c.req.raw))`.
- **Impact:** total. The application was unusable end to end.

### 4.2 The demo could not be seeded, and `npm install` failed

- **Symptom:** `npm run db:seed` → `Error: Cannot find module 'drizzle-orm'`.
- **Cause:** the root CLI script imported `drizzle-orm`, which npm had installed only under `apps/api/node_modules`. Separately, `better-auth@1.6` requires `drizzle-orm@^0.45.2` while the repo pinned `^0.40.0`, so a clean `npm install` failed with `ERESOLVE` and left a stale nested copy behind.
- **Fix:** declare what the root CLI imports, upgrade `drizzle-orm` to `0.45.x` and `drizzle-kit` to `0.31.x`, reinstall, verify the API still typechecks against the new version.
- **Impact:** a fresh clone could not be brought up by following the README.

### 4.3 Every resume upload returned HTTP 500

- **Symptom:** `POST /api/resumes/import` → `The ML service could not parse that file (500)`.
- **Cause:** in the ML service, `logger.info("parsed resume", extra={"filename": …})`. Python's `LogRecord` already owns `filename`, so `makeRecord` raises `KeyError` — after the document was parsed correctly.
- **Fix:** prefixed the extras and added `ml-service/tests/test_api.py`, which exercises `/health`, `/match` and `/parse-resume` (DOCX, TXT, too-short, garbage, oversize).
- **Impact:** the resume manager's headline feature — "upload your PDF" — failed 100% of the time.

### 4.4 The status panel claimed capabilities that were not on

- **Symptom:** the API reported `features.semanticMatching: true` while the ML service reported `embeddings_available: false`.
- **Cause:** the API only checked whether the service responded.
- **Fix:** propagate `embeddings_available` through `ml-client` → `/api/health/deep` → the sidebar, which now reads `ML (semantic + parsing)` or `ML (parsing only)`.
- **Impact:** silent misreporting of the product's core promise. The rule now: no fake green dots.

### 4.5 `npm test` was wired up but ran nothing

- **Symptom:** `vitest run` → `No test files found`, exit code 1.
- **Cause:** the script existed, the tests never did.
- **Fix:** 70 tests across four workspaces (see §5).

### 4.6 Other defects found and fixed

| Defect | Consequence | Fix |
|---|---|---|
| Matcher regexes used `\p{L}` without the `u` flag | Silently degraded to substring matching: "Java" matched "JavaScript", inflating and deflating scores | `giu` everywhere + boundary regression tests |
| Four TypeScript errors in the API | `tsc` did not compile — the API could only ever run through `tsx` | Corrected the call signatures; `typecheck` is part of `check` |
| `0000_minor_bushwacker.sql` migration was stale/non-appliable | A fresh database could not be built from migrations | Regenerated as `0000_overjoyed_magma.sql` and verified with a full push |
| `scripts/setup.ts` started Postgres in-process | The database died the moment setup exited, so `npm run dev` hit a dead DB | Setup spawns a detached `db:local` process and polls until it accepts connections |
| `scripts/setup.ts` adopted *any* Postgres already listening on the port | It happily pushed this schema into a database another project owned (or an older ApplyAI's), and drizzle-kit then died half-way through `ALTER TABLE` | Setup only adopts a cluster it can prove is this repo's (`postmaster.pid`/state file); otherwise it refuses, names the foreign tables it found, and suggests a free port. `npm run db:reset` rebuilds a database you confirm is yours |
| Duplicate application row in `scripts/seed-data.ts` | The demo account showed ten applications where nine were intended | Removed |
| URL importer surfaced raw transport errors | `{"error":"fetch failed"}` for private/blocked postings | Translated into an actionable message; covered by tests |
| Location dedupe compared case-sensitively | "Berlin, berlin" could reach the UI | Case-insensitive dedupe + regression test |
| Biome linted build output (17 786 diagnostics) and 134 real lint errors remained | `npm run lint` was unusable as a gate | `files.ignore` for build output; fixed the real findings (index keys, `<label>` semantics, `<dialog>`, exhaustive deps) — now zero errors |
| Dead code: `ml-service/src/{matcher,scraper}.py`, `apps/web/src/components/RootLayout.tsx`, stray re-exports | Confusing for anyone reading the repo; `matcher.py`/`scraper.py` imported libraries that are not installed | Deleted; the working implementations live in `apps/api/src/match/` and `apps/api/src/discovery/` |
| Local DB cluster (`.localdb/`) and scratch files were not ignored | `git add -A` would have committed a 40 MB Postgres cluster | Added to `.gitignore` |

### 4.7 What a second machine (real Windows run) exposed

The repair was developed and verified on Linux; the same steps were then run on a
Windows machine with Node 24 / npm 12. Three things showed up that the first pass
had not covered — all three are now fixed or documented.

**a) npm 12 blocks dependency install scripts by default.** The install printed
`6 packages had install scripts blocked`, and nothing failed: npm 12 skips
lifecycle scripts for anything not listed in `package.json`'s `allowScripts`, and
exits 0. Two of the blocked packages matter to this project (`esbuild` and
`@embedded-postgres/windows-x64`).

- `package.json` now declares `allowScripts` for every install-script package in
  the lockfile (`esbuild`, `fsevents`, `@biomejs/biome`, all
  `@embedded-postgres/*` platform packages), so a fresh clone is quiet on npm 12
  and unchanged on npm 10/11, which ignore the field.
- Setup spawned its helper commands with `shell: true` and an argument array,
  which Node 24 flags as `DEP0190` (the warning is visible in the user's log).
  Both spawn sites now re-enter npm through `npm_execpath` with the current Node
  binary, so no shell is involved and the warning is gone.
- The Postgres half is a non-issue, and that is verifiable rather than assumed:
  `@embedded-postgres/windows-x64` ships real `initdb.exe`/`pg_ctl.exe` files and
  its `pg-symlinks.json` manifest is `[]`, so the blocked postinstall
  (`hydrate-symlinks.js`) has nothing to hydrate on Windows. Vite starting
  successfully in the same run proves `esbuild` was fine too.

**b) A leftover database from an older ApplyAI was adopted.** The machine already
had a Postgres listening on 5433, created by a previous version of this project
(it contained `analytics_events` and a `resumes` table without `file_name`). The
old setup script saw "the port answers", assumed it was its own, and pushed the
new schema over it. `drizzle-kit push` crashed mid-way with
`TypeError: Cannot read properties of undefined (reading 'columns')` inside
`preparePgAlterColumns`, leaving the database half-migrated, and the seed then
died on `42703 column "file_name" of relation "resumes" does not exist`. The user
was told "Setup complete" anyway, because setup only looked at whether the child
processes were *spawned*, not how they exited.

Three fixes, all in `scripts/`:

- `setup.ts` verifies the cluster is ours (a live `postmaster.pid` under
  `.localdb/`, or the docker-compose container) before adopting it. A reachable
  database it cannot claim stops the run with the tables it found and three
  concrete options.
- Exit codes are honoured: a failed schema push or a failed seed exits non-zero
  instead of printing "Setup complete".
- `npm run db:reset` was added (drop `public` → push → seed) for databases that
  are already broken, with a `--yes` guard so it never wipes a remote or a
  stranger's localhost database by default. Verified against a deliberately
  stale database: the guard refuses, `--yes` rebuilds it in place, and the
  result has the 11 current tables, `resumes.file_name`, and the demo data.

**c) The web entry file vanished from the working tree.** Vite failed with
`Failed to load url /src/main.tsx (resolved id: D:/.../apps/web/src/main.tsx) in
.../index.css. Does the file exist?` — five times, once per reload. The file is
committed (121 files in this change include it) and present in a fresh clone
here; deleting it reproduced the message byte for byte, so the diagnosis is not
speculation: on that machine the file is genuinely not readable by Vite.

The second run added the detail that rules out Git: it happened on a *fresh
clone* of a commit that contains the file, so the file was written and then
removed or locked by something outside Git. The same log also settled the path
question — the shell prompt says `D:\PROJECTS 2026\...` while every tool reports
`D:\_Organized\01_Dev\PROJECTS 2026\...`, so the projects folder is reached
through a **junction/symlink** and the real tree lives under a folder whose name
(`_Organized`) suggests exactly the kind of tool that moves files around.

A machine-local file watcher cannot be debugged from a Linux box, so the answer
is a diagnostic rather than another guess: **`npm run doctor`** (new) *reads*
every file the app needs instead of listing it, which separates "missing"
(`ENOENT` → `git restore <file>`) from "present but locked" (`EACCES`/`EPERM` →
antivirus or sync client), warns when the checkout is reached through a junction
or sits in a synced folder, and checks the runtime, the install-script
approvals, `.env`, the database (including the exact half-migrated `resumes`
state from (b)) and the ports. It exits non-zero when `npm run dev` would fail.

None of this changes the Linux-side verification below; it is the reason the
guides now distinguish "the repo is broken" from "this machine has leftovers",
which is the difference between the two failure modes a new user actually hits.

---

## 5. What was done

**Made it run.** `npm install && npm run setup && npm run dev` now works from a
clean checkout: embedded Postgres (no Docker), schema push, demo seed, API on
`:4000`, web on `:5173`.

**Made it honest.** Every claim in the README maps to code you can point at;
optional capabilities report their real state; features that do not exist were
removed from the documentation instead of implemented badly.

**Made it verifiable.** 70 automated tests, all passing:

```
packages/shared   12   schema contracts: statuses, defaults, bounds, coercion
apps/api          35   matcher (separation, boundaries, breakdown maths),
                       discovery normalisation, URL importer, error paths
apps/web          11   the real route tree rendered against recorded API
                       responses: sign-in journey, auth gating, every page,
                       failure banners
ml-service        12   /health capability reporting, /match degradation,
                       /parse-resume for DOCX/TXT/short/garbage input
```

Plus, as a live check against the running stack: `17/17` API lifecycle steps
(sign-up → session → resume → track job → score → three stage moves → cover
letter → analytics → discovery → validation → delete), a full DOCX upload
through the ML service, and every page rendered with real data.

`npm run smoke` (scripts/smoke-api.mjs) re-runs that lifecycle probe against
whatever instance `API_URL` points at.

**Made it recoverable.** Most people meet this project on a machine that already
has leftovers, so the failure paths are first-class too: `npm run db:local:status`
says what is running and where it came from, `npm run db:reset` rebuilds a
database in place, `npm run setup -- --port <n>` starts a second independent one,
and setup refuses to touch anything it cannot prove is its own. `npm run check`
now also typechecks the root `scripts/` — that is the first code anyone runs, and
it had no coverage at all before.

---

## 6. What is still limited (deliberately)

- **Discovery depends on public APIs.** If those hosts are unreachable (as in a
  locked-down sandbox), Job Scout returns zero jobs and lists the per-source
  errors. That is the designed behaviour, not a bug — but it means discovery is
  only as good as your network.
- **No LinkedIn/Indeed/Naukri scraping, and I did not add any.** It violates
  their terms, breaks constantly, and gets accounts banned. Public ATS board
  APIs plus aggregator APIs cover a large share of real postings legally.
- **No email/OAuth integrations.** Both need credentials only you can create;
  the architecture leaves room, the code does not pretend to have them.
- **Rate limiting is in-memory**, so it is per-process. Fine for one node;
  swap the store for Redis before scaling out.
- **Cover letters without Ollama are templates.** They are accurate and
  grounded, but they read like a well-structured template.
- **Analytics are only as good as your data entry.** The "response rate"
  depends on you moving cards honestly.

---

## 7. If you continue

Ordered by value per hour:

1. **Interview-loop detail per application** (recruiter names, rounds, notes per
   round, next-date reminders). This is where a real search creates the most
   anxiety and where a tool earns daily use.
2. **Follow-up queue that actually nags** — browser notifications or a daily
   digest of overdue follow-ups, not just a list.
3. **Resume diffing** — score the same resume against a posting before/after an
   edit, so tailoring becomes measurable instead of a feeling.
4. **Import from email** (Gmail/IMAP read-only) to auto-create events from
   application confirmations and rejections. Highest leverage, highest effort.
5. **Export/backup** (JSON + CSV) and a delete-my-account path — trust features
   that a self-hosted tool should have.
6. **Embeddings in the default install** if you can afford the 2 GB: it is a
   real quality bump on paraphrased requirements, and the blend already knows
   how to use it.

Keep the invariant that made this repair possible: **the optional services stay
optional, and the UI never claims something is on when it is not.**
