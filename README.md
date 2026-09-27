# Adaptive — Academic Companion

**Team Kryon** · Sahil K George · Karthik G Pilla · Pranav Narayanan · Jestes Jen

An adaptive academic companion that turns unstructured student workload into realistic,
personalised and collaborative action plans.

Adaptive is a student-centric web app that converts messy input — a brain dump, a PDF of
lecture notes, your available time and knowledge level — into a realistic, explainable and
**adaptive** study plan, with a Team Mode for shared goals that still keeps each student's
plan personal.

Built on **Next.js 16 (App Router) + React 19 + TypeScript**, with a deterministic planning
engine, a per-user AI layer, and a pluggable data store.

---

## Quick start

```bash
npm install
npm run dev
# open http://localhost:3000
```

No environment variables, database or API key is required for local development. On first run
the app seeds a demo scenario into `.data/db.json`.

### Demo account

| Email | Password |
| --- | --- |
| `sahil@university.edu` | `demo1234` |

The demo account is the only account that gets the deterministic engine automatically — see
[AI layer](#ai-layer) for how every other account works. You can also register a fresh account
from `/onboarding`.

---

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest (storage degradation tests) |

---

## What works

**Core loop:** brain dump → understand → extract → prioritise → plan → execute → track → adapt.

- **Auth** — register, login, logout, session cookies, forgot/reset password (scrypt hashing).
- **Subjects & knowledge** — subjects with 1–5 confidence levels that feed planning.
- **Goals** — Fast Prep / Keep Up goals with target dates.
- **Brain Dump** — natural-language extraction of tasks, deadlines, subjects, knowledge gaps,
  collaborators and goals, shown for review/edit **before** anything is saved.
- **Notes → prep plan** — upload a PDF, `.txt` or `.md`; text is extracted server-side and
  split into topics, each with a learn → practice → recall sequence. Review it, then commit
  the subtasks as dated tasks spread over the coming days, with an optional goal.
- **Planning engine** — deterministic priority scoring with per-item reasons, break-aware time
  fitting, Fast Prep and Keep Up planning.
- **Adaptive planning** — completion, skip, overrun (task took longer), deadline and
  available-time changes all trigger a recalculation.
- **Team Mode** — create/join teams by code or discovery, shared goal, discussions, resources,
  activity feed, member knowledge maps, strengths, gaps and peer-learning recommendations.
- **Progress** — task completion, subject breakdown, study time, per-team coverage.
- **Well-being / workload** — workload check-in, overload detection, one-click rebalance, break
  timer and breathing guide.

---

## Architecture

```text
                     ┌─────────────────────┐
                     │  Next.js App Router │
                     │  Dashboard · Planner│
                     │  Subjects · Teams   │
                     │  Progress · Settings│
                     └──────────┬──────────┘
                                │  /api/*  (route handlers)
                     ┌──────────▼──────────┐
                     │  Server layer       │
                     │  auth · repo        │
                     │  planning · pdf     │
                     └────┬───────────┬────┘
                          │           │
               ┌──────────▼──┐   ┌────▼─────────────┐
               │ Engines     │   │ Store            │
               │ priority    │   │ supabase → file  │
               │ planner     │   │ → memory fallback│
               │ braindump   │   └──────────────────┘
               │ notes       │   ┌──────────────────┐
               │ team        │   │ AI               │
               │ workload    │   │ per-user key or  │
               └─────────────┘   │ env default      │
                                 └──────────────────┘
```

### Layout

```text
src/lib/engine/        Deterministic engines (pure, no I/O)
  priority.ts          Explainable task scoring
  planner.ts           Break-aware plan builder + adaptive event application
  braindump.ts         Deterministic NL extraction
  notes.ts             Deterministic notes → learn/practice/recall split
  team.ts              Knowledge map, strengths, gaps, peer recommendations
  workload.ts          Overload detection + rebalance maths

src/lib/ai/            AI resolution, provider catalog, prompts
  index.ts             resolveAI() — user key, then env, then demo
  models.ts            Curated provider + model catalog for the Settings UI
  providers/           mock · openai-compatible (OpenAI/OpenRouter/Grok) · gemini

src/lib/server/        Data layer
  store.ts             Supabase → file → memory adapter chain
  auth.ts              scrypt hashing, session and reset tokens
  repo.ts              All persistence and authorization rules
  planning.ts          Bridges storage to the pure engines
  pdf.ts               Server-side PDF text extraction (pdfjs legacy build)
  seed.ts              Demo scenario, date-rebased so it is always current
  http.ts              route() wrapper, requireUser, JSON helpers

src/app/api/           32 route handlers (all private routes require a session)
src/app/               16 pages
src/lib/store.tsx      Client store, loaded from /api/bootstrap
tests/                 Vitest suites
```

### Responsibility split

| AI is used for | Deterministic code owns |
| --- | --- |
| Brain dump language understanding | Auth & authorization |
| Notes → study structure | Persistence & validation |
| Goal decomposition | Deadlines, task state |
| Study strategy / explanations | Priority, scheduling, progress |

---

## AI layer

Resolution order for every AI request (`src/lib/ai/index.ts`):

1. **The user's own key** — configured in the app at `/settings`. Takes priority.
2. **Server environment** — `AI_PROVIDER` plus a matching key, as a deployment-wide default.
3. **Deterministic engine** — available to the demo account automatically, and to any account
   that explicitly selects it in Settings.
4. **No service** — a real account with no key and no env default gets `service: null` and a
   `402` with a message pointing them at Settings. It does *not* silently return mock output.

Supported providers: **OpenRouter**, **Grok (xAI)**, **OpenAI**, **Google Gemini**, and the
built-in **deterministic** engine. OpenAI-compatible providers share one implementation.
`src/lib/ai/models.ts` holds the curated model list; the Settings UI also accepts a custom
model id.

Two behaviours worth knowing:

- **Provider failure falls back to the deterministic engine only in demo mode.** For a real
  account on their own paid key, a provider error is surfaced rather than silently downgraded.
- **Keys are never returned to the client.** Stored server-side per user; API responses expose
  only a masked form (`maskKey`).

### Environment variables (all optional)

| Variable | Purpose |
| --- | --- |
| `AI_PROVIDER` | `mock` · `openai` · `gemini` · `openrouter` · `grok` |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | OpenAI default |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | Gemini default |
| `OPENROUTER_API_KEY` / `OPENROUTER_MODEL` | OpenRouter default |
| `XAI_API_KEY` / `GROK_MODEL` | Grok default |
| `APP_URL` | Sent to OpenRouter as the `HTTP-Referer` attribution header |
| `DEMO_MODE` | `true` treats every account as a demo account |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Durable storage (see below) |

Copy `.env.example` to `.env.local` to change any of them. Users can also bring their own key
in `/settings`, which takes priority over these.

---

## Data store

The store degrades in three steps, and the active one is reported at `/api/bootstrap`:

| Order | Adapter | When |
| --- | --- | --- |
| 1 | **Supabase** | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set and reachable |
| 2 | **File** (`.data/db.json`) | No Supabase configured, and the filesystem is writable |
| 3 | **Memory** | Filesystem is read-only — per-instance, non-durable |

The writability probe (`store.ts:149`) runs once at startup. Serverless platforms ship a
read-only bundle filesystem where only `/tmp` is writable, so a naive write on `process.cwd()`
throws; probing up front lets the app fall back deliberately instead of returning a 500 on
every request. `tests/store.test.ts` covers this path.

### Supabase setup

Run once in the Supabase SQL editor:

```sql
create table if not exists app_state (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
```

Then set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. The adapter talks to PostgREST over
plain `fetch` — no SDK, no Node APIs — so it works on any runtime.

> **Set Supabase for any real deployment.** The file store is wiped on every deploy and restart
> on container and serverless hosts, and the memory store is lost whenever the instance is
> recycled. Additionally, the whole database is a single JSON document under one key, so
> concurrent writers can overwrite each other — acceptable for a demo, not for real traffic.

---

## API surface

All owner-scoped and team-scoped data is authorised server-side (`requireUser`,
`assertTeamAccess`).

| Area | Routes |
| --- | --- |
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/session`, `POST\|PUT /api/auth/password` |
| Bootstrap | `GET /api/bootstrap` — everything the client store needs, in one round trip |
| Profile | `GET\|PATCH /api/profile` |
| AI settings | `GET\|PATCH /api/settings/ai` |
| Subjects | `GET\|POST /api/subjects`, `PATCH\|DELETE /api/subjects/[id]` |
| Goals | `GET\|POST /api/goals`, `PATCH\|DELETE /api/goals/[id]` |
| Tasks | `GET\|POST /api/tasks`, `PATCH\|DELETE /api/tasks/[id]` |
| Brain dump | `POST /api/braindump` (extract), `PUT /api/braindump` (commit) |
| Notes | `GET\|POST /api/notes`, `DELETE /api/notes/[id]`, `POST /api/notes/commit` |
| Plan | `GET\|POST\|PATCH /api/plan` (read / record event / update preferences) |
| Study sessions | `GET\|POST /api/study-sessions` |
| Teams | `GET\|POST /api/teams`, `POST /api/teams/join`, `GET\|PATCH\|DELETE /api/teams/[id]` |
| Team detail | `.../messages`, `.../checkins`, `.../members/[memberId]` |
| Resources | `GET\|POST /api/resources`, `DELETE /api/resources/[id]` |
| Progress | `GET /api/progress` |
| Notifications | `GET\|POST /api/notifications`, `PATCH /api/notifications/[id]` |
| Well-being | `POST /api/wellbeing` |

---

## Security notes

- Passwords hashed with scrypt; sessions are opaque server-side tokens in httpOnly cookies.
- `requireUser` guards every private route; team access is checked on every team route.
- Per-user AI keys are stored server-side and only ever returned masked.
- Input validation on all mutations; no secrets in the client bundle.
- Password reset returns the token directly **only because no email provider is configured** —
  wire an email service and stop returning `reset_token` before production.

---

## Deployment

Works on any Node host: Vercel, Railway, Render, Fly, or a container. Next.js needs no extra
config.

**On serverless, Supabase is required for persistence.** Without it the app still boots and
the demo account still signs in, but data lives in the per-instance memory store and is lost
on every cold start. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the host's
environment settings before your first deploy.

Not suitable for Cloudflare Workers/Pages as written: `node:fs` and `process.cwd()` are
unavailable, and `scryptSync` in the auth layer is not implemented in that runtime. Porting
would mean Supabase as the only store, replacing scrypt with WebCrypto PBKDF2, and the
OpenNext adapter.

---

## Demo scenario

Log in as the demo student:

1. **Planner** → brain dump is pre-filled → *Extract data* → review tasks, gaps, goals, team.
2. **Confirm & create** → tasks and goals appear, the gap lowers your Maths confidence.
3. **Dashboard** shows the next step with its reasons, the plan, and the workload assessment.
4. *Start session* → *Mark complete*, or overrun a task to see **adaptive rescheduling**.
5. **Planner → Notes to Prep** → upload a PDF, `.txt` or `.md` → *Split into prep* →
   review the topic split → *Add to my plan*.
6. **Teams** → `Maths Survivors` → knowledge map, strengths, gaps, peer recommendation.

---

## Roadmap (intentionally out of scope)

Lecture/video analysis, full LMS and calendar sync, public profiles, gamification, real-time
co-editing, and autonomous AI actions are documented as future work and are deliberately not
implemented.

---

## Known limitations

Recorded honestly so they are not a surprise:

- The file and memory stores are single-process only. The write queue serialises mutations
  **in-process**, so multiple instances each hold their own copy and can lose writes. Supabase
  removes this constraint but still stores the database as one document, so concurrent writers
  can still overwrite each other.
- Every read re-reads the database, and `transact` persists unconditionally — read-only
  requests also write. With a network-backed store this is several round trips per request.
- `POST /api/tasks` accepts a `team_id` from the request body without verifying team
  membership, unlike the equivalent check on `POST /api/resources`.
- PDF import requires selectable text. Scanned pages need OCR first and return a `422`.
- `/team-join` and `/team-workspace` are thin aliases of `/teams` and the team detail view.
- Route protection is client-side; enforcement is server-side via `requireUser`.
