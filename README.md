# Adaptive — Academic Companion

> An adaptive academic companion that turns unstructured student workload into realistic,
> personalised and collaborative action plans.

Adaptive is a student-centric web app that converts messy input (a "brain dump"), available
time, knowledge level and goals into a realistic, explainable and **adaptive** study plan — with
a Team Mode for shared goals that still keeps each student's plan personal.

Built on **Next.js 16 (App Router) + React 19 + TypeScript**, with a deterministic planning
engine, a pluggable AI layer, and a zero-config data store.

---

## Quick start

```bash
npm install
npm run dev
# open http://localhost:3000
```

No environment variables, database or API key is required. On first run the app seeds the demo
scenario and stores data in `.data/db.json`.

### Demo account

| Email | Password |
| --- | --- |
| `sahil@university.edu` | `demo1234` |

Or register a fresh account from **/onboarding**.

---

## What works

**Core loop:** brain dump → understand → extract → prioritise → plan → execute → track → adapt.

- **Auth** — register, login, logout, session cookies, forgot/reset password (scrypt hashing).
- **Subjects & knowledge** — subjects with 1–5 confidence levels that feed planning.
- **Goals** — Fast Prep / Keep Up goals with target dates.
- **Brain Dump** — natural-language extraction of tasks, deadlines, subjects, knowledge gaps,
  collaborators and goals, shown for review/edit **before** anything is saved.
- **Notes → Prep** — upload a notes PDF (or text) in the study plan section; the text is extracted
  and split into a topic-by-topic **learn → practice → recall** sequence, which becomes real tasks
  (and optionally a Fast Prep goal) spread across your chosen number of days.
- **Bring your own AI key** — Settings page with provider + **model selector** and per-user API key
  for **OpenRouter**, **Grok (xAI)**, OpenAI and Gemini. The key is stored server-side and never
  returned to the browser.
- **Planning engine** — deterministic priority scoring with per-item reasons, break-aware time
  fitting, Fast Prep and Keep Up planning.
- **Adaptive planning** — completion, skip, overrun (task took longer), deadline and
  available-time changes all trigger a recalculation.
- **Team Mode** — create/join teams by code or discovery, shared goal, discussions, resources,
  activity feed, member knowledge maps, strengths, gaps and peer-learning recommendations.
- **Progress** — task completion, subject breakdown, study time, per-team coverage.
- **Well-being / workload** — workload check-in, overload detection and one-click rebalance.

Every button either works or is intentionally absent. The AI layer is **AI-assisted, not
AI-dependent**: the app is fully functional with no API key.

---

## Architecture

```text
                    ┌─────────────────────┐
                    │  Next.js App Router │
                    │  Dashboard · Planner│
                    │  Subjects · Teams   │
                    │  Progress · Wellbeing│
                    └──────────┬──────────┘
                               │  /api/*  (route handlers)
                    ┌──────────▼──────────┐
                    │  Server layer       │
                    │  auth · repo        │
                    │  planning · http    │
                    └────┬───────────┬────┘
                         │           │
              ┌──────────▼──┐   ┌────▼─────────────┐
              │ Engines     │   │ Store            │
              │ priority    │   │ file (default)   │
              │ planner     │   │ → Supabase failover
              │ team        │   └──────────────────┘
              │ workload    │
              │ braindump   │   ┌──────────────────┐
              └─────────────┘   │ AI (AIService)   │
                                │ mock/openai/gemini│
                                └──────────────────┘
```

### Layout

```text
src/lib/engine/       Deterministic engines (no I/O, unit-testable)
  priority.ts         Explainable task scoring
  planner.ts          Break-aware plan builder + adaptive event application
  braindump.ts        Deterministic NL extraction (mock provider + fallback)
  team.ts             Knowledge map, strengths, gaps, peer recommendations
  workload.ts         Overload detection + rebalance maths

src/lib/ai/           AIService abstraction + providers (mock/openai/gemini)
src/lib/server/       Data layer: store, auth, repo, planning, seed, http helpers
src/app/api/          Route handlers (all private routes require a session)
src/app/              Pages (dashboard, planner, subjects, teams, progress, ...)
src/lib/store.tsx     Client store loaded from /api/bootstrap
```

### Responsibility split

| AI is used for | Deterministic code owns |
| --- | --- |
| Brain dump language understanding | Auth & authorization |
| Goal decomposition | Persistence & validation |
| Study strategy / explanations | Deadlines, task state |
| (optional) quiz generation | Priority, scheduling, progress |

---

## Configuration (all optional)

Copy `.env.example` to `.env.local` if you want to change defaults.

### AI provider

Two layers, resolved per request:

1. **Per-user settings** (Settings page) — provider + model + key stored for that account.
2. **Server environment** — `AI_PROVIDER` + matching key as a deployment-wide default.

Supported providers: `openrouter`, `grok`, `openai`, `gemini`, and `mock` (the built-in
deterministic engine). `OPENROUTER_API_KEY`, `XAI_API_KEY`, `OPENAI_API_KEY` and
`GEMINI_API_KEY` are read from the environment when `AI_PROVIDER` matches.

**Fallback policy:** the deterministic engine is a *fallback* only in demo mode. The demo
account (and any deployment with `DEMO_MODE=true`) degrades gracefully when no key is present or
a provider call fails. A **real account without a key gets a clear `402`** asking it to add a key
in Settings, rather than silently receiving mock output. Anyone may still explicitly choose
“Deterministic (no key)” as their provider.

### Data store

- **Default:** local JSON file at `.data/db.json` — zero config.
- **Supabase failover:** set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (or
  `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Supabase becomes the primary
  store, and the file store takes over automatically if Supabase errors. Create the table once:

```sql
create table if not exists app_state (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
```

---

## API surface

| Area | Routes |
| --- | --- |
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/session`, `POST|PUT /api/auth/password` |
| Bootstrap | `GET /api/bootstrap` (everything the client store needs) |
| Profile | `GET|PATCH /api/profile` |
| AI settings | `GET|PATCH /api/settings/ai` (providers/models/key) |
| Notes | `GET|POST /api/notes` (upload + split), `POST /api/notes/commit`, `DELETE /api/notes/[id]` |
| Subjects | `GET|POST /api/subjects`, `PATCH|DELETE /api/subjects/[id]` |
| Goals | `GET|POST /api/goals`, `PATCH|DELETE /api/goals/[id]` |
| Tasks | `GET|POST /api/tasks`, `PATCH|DELETE /api/tasks/[id]` |
| Brain Dump | `POST /api/braindump` (extract), `PUT /api/braindump` (commit) |
| Plan | `GET|POST|PATCH /api/plan` (read / record event / update preferences) |
| Teams | `GET|POST /api/teams`, `POST /api/teams/join`, `GET|PATCH|DELETE /api/teams/[id]` |
| Team detail | `.../messages`, `.../checkins`, `.../members/[memberId]` |
| Resources | `GET|POST /api/resources`, `DELETE /api/resources/[id]` |
| Progress | `GET /api/progress` |
| Notifications | `GET|POST /api/notifications`, `PATCH /api/notifications/[id]` |
| Well-being | `POST /api/wellbeing` |

All owner-scoped and team-scoped data is authorised server-side (`requireUser`, `assertTeamAccess`).

---

## Security notes

- Passwords hashed with scrypt; sessions are opaque server-side tokens in httpOnly cookies.
- `requireUser` guards every private route; team access is checked on every team route.
- Input validation on all mutations; no secrets in the client bundle.
- Password reset returns the token directly **only because no email provider is configured** in
  the prototype — wire an email service and stop returning `reset_token` for production.

---

## Demo scenario

Log in as the demo student and you get the plan's primary demonstration out of the box:

1. **Planner** → brain dump is pre-filled → *Extract data* → review tasks / gap / goal / team.
2. **Confirm & create** → tasks and goals appear, the gap lowers your Maths confidence.
3. **Dashboard** shows the next step with its reasons, the plan and the workload assessment.
4. *Start session* → *Mark complete*, or overrun a task to see **adaptive rescheduling**.
5. **Teams** → `Maths Survivors` team → knowledge map, strengths, gaps and peer recommendation.

---

## Scripts

```bash
npm run dev      # start the dev server
npm run build    # production build
npm run start    # run the production build
npm run lint     # eslint
```

## Roadmap (intentionally out of MVP scope)

Lecture/video analysis, full LMS / calendar sync, public profiles, gamification, real-time
co-editing and autonomous AI actions are documented as future work and are deliberately not
implemented.
