# Backend / Frontend Implementation Audit — Adaptive Academic Companion

## Verdict

**Both are implemented and substantial.** This is not a scaffold — the backend is a real
server layer and the frontend is a real wired UI, not placeholder screens.

Evidence gathered (static analysis + prior build artifacts; `tsc`, `npx` and `curl` were blocked
by the sandbox so no command was executed against the running app).

| Area | Status | Evidence |
| --- | --- | --- |
| API layer | **Done** | 28 route handlers under `src/app/api/`, all compiled into `.next/app-path-routes-manifest.json:4-31` |
| Auth | **Done** | scrypt hashing, opaque server-side sessions, httpOnly cookie — `src/lib/server/auth.ts:14`, `src/lib/server/http.ts:65` |
| Authorization | **Done** | `requireUser` on every private route; `RepoError`/`HttpError` mapped to JSON in `src/lib/server/http.ts:26` |
| Data layer | **Done** | JSON file store + Supabase failover + serialized transactions — `src/lib/server/store.ts:202`, `src/lib/server/store.ts:252` |
| Planning engines | **Done** | 5 real pure engines, ~1150 lines — `src/lib/engine/{priority,planner,braindump,team,workload}.ts` |
| AI layer | **Done** | Provider factory with automatic mock fallback — `src/lib/ai/index.ts:23`, `src/lib/ai/index.ts:110` |
| Seed / demo data | **Done** | `.data/db.json` is 26 KB and populated, so the app has actually run |
| Frontend pages | **Done** | 13 routes, ~4200 lines, every one wired to the API via `src/lib/store.tsx` |
| Components | **Done** | 9 components incl. a 1253-line `TeamWorkspaceView` |
| Client data flow | **Done** | Single `apiFetch` → `/api/bootstrap` round trip — `src/lib/store.tsx:210`, `src/lib/store.tsx:285` |

The README's "What works" list is accurate. `src/lib/mockData.ts` is only used for static
reference content (break activities, support resources — `src/lib/store.tsx:48`); it is **not**
shadowing the API anywhere.

---

## Gaps found

### P0 — The entire backend is uncommitted

`git status` shows the backend as untracked (`??`):

```
?? src/app/api/          ?? src/lib/server/     ?? src/lib/ai/
?? src/lib/engine/       ?? src/lib/domain.ts
```

The three commits (`0c20735`, `4a6cf6d`, `54dfe64`) contain only the UI skeleton. A
`git clean -fd`, a branch switch, or a fresh clone reproduces a project with **zero backend**:
every page will fail on `/api/bootstrap` and login is impossible. This is the single highest
risk in the repo.

### P1 — Zero tests, despite the code being written for testability

`vitest ^2.1.9` is in `devDependencies` but there is no `test` script and no `*.test.*` /
`*.spec.*` files. The engines are deliberately pure (`src/lib/engine/priority.ts:59` takes
`now` as a parameter for exactly this reason) and the README calls them "unit-testable"
(`README.md:90`), but nothing exercises them. The planning/adaptive logic is the core product
claim and is the least protected code.

### P2 — Dead code and an unused dependency

- `src/lib/supabase.ts` — imported by nothing. Worse, `uploadFileToSupabaseStorage` is a fake:
  it returns `URL.createObjectURL(file)` (`src/lib/supabase.ts:34`), a blob URL that dies with
  the browser tab. Nothing in the app calls it, so this is inert, but it reads like a real
  upload path.
- `ApiClient` interface — `src/lib/api.ts:116` declares a 30-method client contract that is
  never implemented or referenced. The real client is `apiFetch` in `src/lib/store.tsx:210`.
- `pdfjs-dist ^6.3.289` in `package.json:14` — zero imports anywhere in `src/`.

### P2 — Three URLs for two team screens

- `/teams` → `src/app/teams/page.tsx`
- `/team-join` → re-exports the *same* `TeamsPage` (`src/app/team-join/page.tsx:3`)
- `/team-workspace` → re-exports `TeamWorkspaceView` (`src/app/team-workspace/page.tsx:6`)
- `/teams/[teamId]` → also renders `TeamWorkspaceView` (`src/app/teams/[teamId]/page.tsx:8`)

The Sidebar links to `/team-workspace` (`src/components/Sidebar.tsx:41`), so `/teams/[teamId]`
is currently unreachable from the nav. The two wrapper routes are 7-line pass-throughs that
exist only to satisfy nav links.

### P2 — No server-side route guard

Protection is client-only: `AppLayoutClient` fetches `/api/bootstrap`, and on 401 redirects to
`/login` (`src/components/AppLayoutClient.tsx:16`). **No data leaks** — every API route calls
`requireUser`, which enforces server-side (`src/lib/server/http.ts:65`). The cost is a flash of
"Loading your workspace…" on every cold load, and the protected HTML still ships to the browser.
A `src/middleware.ts` doing an optimistic cookie check would fix both.

### Not verified

`tsc`, `npx`, and `curl` are blocked by the sandbox allowlist, so typecheck, lint and a live
request round trip were not run. The strongest available evidence is a **successful production
build** at 21:06 (`.next/BUILD_ID`, full `app-path-routes-manifest.json`, clean
`build-diagnostics.json`) plus a populated runtime DB. This must be re-confirmed manually.

---

## Remediation plan

### Task 1 — Commit the backend (do this first, before anything else)

1. `git add src/app/api src/lib/server src/lib/engine src/lib/ai src/lib/domain.ts .env.example`
2. Verify `.env*` and `/.data/` stay ignored (`/.data/` is already in `.gitignore:38`;
   `.env.example` is whitelisted by `.gitignore:35`). Confirm no key material in the staged set:
   `git diff --cached | rg -i "api[_-]?key|secret|service_role"` must return nothing.
3. Also stage the already-modified frontend files so the tree is coherent:
   `git add -u`
4. Commit as one commit, e.g. `Implement backend: API routes, engines, auth, store, AI layer`.
5. Push to a remote — there is currently none configured (`git remote -v` is empty), so this
   work exists on exactly one disk.

### Task 2 — Add the missing `test` script and engine tests

1. Add `"test": "vitest run"` and `"test:watch": "vitest"` to `package.json` scripts.
2. Add `vitest.config.ts` with the `@/` alias resolved to `src/` (it is set in
   `tsconfig.json` but Vitest does not inherit it).
3. Write the highest-value cases first, all against pure functions:
   - `src/lib/engine/priority.ts` — `scoreTask` with a fixed `now`: overdue scores 40 urgency;
     a low-confidence subject emits the gap reason; a done task is filtered out by `rankTasks`.
   - `src/lib/engine/planner.ts` — breaks are inserted at the configured interval; total
     planned minutes never exceed `availableMinutes`; a `completed` event removes the item; an
     `overrun` event with `actual_minutes` reshapes the remaining slots.
   - `src/lib/engine/workload.ts` — `assessWorkload` crosses into `overloaded` above the
     threshold; rebalance output is non-increasing in load.
   - `src/lib/engine/braindump.ts` — the mock provider extracts a task, a date and a subject
     from a representative brain-dump string, and degrades gracefully on empty input.
4. Every test must pass a fixed `now`; never call `new Date()` inside an assertion path.

### Task 3 — Remove dead code

1. Delete `src/lib/supabase.ts` (nothing imports it). If real file upload is wanted later, that
   is a feature, not a cleanup — do not resurrect it as-is given the fake upload.
2. Delete the `ApiClient` interface from `src/lib/api.ts` (`src/lib/api.ts:116-152`). Keep the
   file: its exported payload and response types are imported by `src/lib/store.tsx:40-47` and
   `src/lib/server/planning.ts:19`.
3. Remove `pdfjs-dist` from `package.json` and run `npm install` to update the lockfile.
4. Re-run `npm run lint` and `npm run build` to confirm nothing referenced them.

### Task 4 — Collapse the duplicate team routes

Pick one canonical shape and make the others redirect:

- Keep `/teams` (list) and `/teams/[teamId]` (detail) as the only real routes.
- Delete `src/app/team-join/page.tsx` and `src/app/team-workspace/page.tsx`.
- Point the Sidebar entry at `/teams` and deep-link into `/teams/{id}`
  (`src/components/Sidebar.tsx:41`).
- If the old URLs must keep working, replace the two wrapper pages with
  `redirect('/teams')` / `redirect('/teams')` rather than re-exporting components — this
  removes the double-mount risk from rendering a page component inside another route's file.

### Task 5 — Add optimistic server-side route protection

1. Create `src/middleware.ts` matching everything except `/api`, `/_next`, and the static assets.
2. Read the `adaptive_session` cookie (name from `src/lib/server/auth.ts:11`). If absent,
   `NextResponse.redirect` to `/login`; if present and the path is public, redirect to
   `/dashboard`.
3. This is an optimisation, not a security control. `requireUser`
   (`src/lib/server/http.ts:65`) remains the only thing that actually enforces access — do not
   treat the middleware check as authorisation.
4. Note the tradeoff: reading the cookie in middleware is fine, but the middleware runs on the
   Edge runtime and `src/lib/server/store.ts` uses `node:fs` — never import server storage from
   middleware.

---

## Validation

Run manually — the sandbox blocks `tsc`/`npx`/`curl`, so none of this has been executed:

```bash
npm run build            # must complete; verify .next/app-path-routes-manifest.json lists all 28 API routes
npm run lint
npm run test             # new script from Task 2
npm run dev
```

Then walk the README demo scenario (`README.md:177`) end to end:

1. Log in as `sahil@university.edu` / `demo1234` (`src/lib/server/seed.ts:26-27`).
2. `/planner` → *Extract data* → *Confirm & create*; confirm tasks persist across a reload.
3. `/dashboard` → start a session → mark complete → confirm the plan reschedules.
4. Overrun a task (`actualMinutes` > estimate) → confirm adaptive re-planning.
5. `/teams` → open `Maths Survivors` → knowledge map, strengths, gaps, peer recommendation.
6. `/api/bootstrap` with no cookie → expect `401` (proves server-side enforcement, independent
   of the client redirect).
7. Register a second account → confirm zero data bleed from the demo account (owner scoping).

## Out of scope

Everything the README lists as future work (section "Roadmap", `README.md:196`): lecture/video
analysis, LMS/calendar sync, public profiles, gamification, real-time co-editing, autonomous AI
actions. Also out of scope: swapping the JSON file store for a real relational database, and
wiring the reset-password token to a real email provider.
