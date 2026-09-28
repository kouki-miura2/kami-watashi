# apps/backend-worker

- Cloudflare Workers entrypoint for `apps/backend`. `src/worker.ts` wires concrete dependencies (DAO → repository → service) into `createApp` from `backend/src/app.ts` and exports `{ fetch, scheduled }` — `scheduled` runs the daily Cron Trigger in `wrangler.jsonc` (auto-deletion of inactive families); routes and business logic stay in `apps/backend`.
- Workers-only code lives here, never in `apps/backend`: DAOs backed by Cloudflare bindings (`src/dao/*.d1.ts`, `*.r2.ts`, ...) implementing the interfaces in `backend/src/dao/*.interface.ts`, and anything that touches `env` bindings. These are the only DAO implementations (`apps/backend` has no in-memory DAOs); for local runs, `wrangler dev` simulates D1/R2.
- Config is `wrangler.jsonc`. After adding bindings, run `vp run backend-worker#cf-typegen` to regenerate `worker-configuration.d.ts` (untracked).
- Secrets: use `wrangler secret put`, never `.env` / commit `.dev.vars`.
- D1 writes that can hit a UNIQUE constraint end in `.catch(rethrowUniqueConstraint)` (`src/dao/d1-errors.ts`), and history rows go in the same `db.batch()` via `insertHistory` (`src/dao/history.d1.ts`).
- D1 schema changes are new files in `migrations/` (`NNNN_<name>.sql`), never edits to applied ones. Apply with `vp run backend-worker#db:migrate:local` / `db:migrate:remote`.
- DAO tests (`src/dao/*.d1.test.ts`) run under `vp test` against a fresh in-memory local D1 from `createTestD1()` (`src/dao/d1.testing.ts`: wrangler's `getPlatformProxy` + every migration applied), so they exercise the real SQL, constraints and FK cascades.

## Local development

The auth guard stays on locally. Sign in through `POST /dev/login`, which exists only when `DEV_LOGIN_ENABLED=true` — a value that goes in `.dev.vars` (gitignored, never uploaded by `wrangler deploy`) and must never be added to `wrangler.jsonc` `vars` or secrets.

1. Create `apps/backend-worker/.dev.vars`:

   ```
   SESSION_SECRET=<any long random string>
   DEV_LOGIN_ENABLED=true
   ALLOWED_ORIGINS=http://localhost:5173,capacitor://localhost,https://localhost
   ```

2. `vp run backend-worker#db:migrate:local`, then `vp run backend-worker#dev` (http://localhost:8787; D1/R2 are simulated under `.wrangler/state`).
3. Sign in as an owner (creates the family on first use) and call the API with the returned token:

   ```bash
   curl -X POST http://localhost:8787/dev/login -H 'content-type: application/json' --data-binary @login.json   # {"googleSub":"dev-owner-1","name":"一郎"}
   curl http://localhost:8787/members -H 'authorization: Bearer <sessionToken>'
   ```

4. Join as an invited member with the owner's invite token, and use the returned member key:

   ```bash
   curl -X POST http://localhost:8787/invites -H 'authorization: Bearer <sessionToken>'
   # → { "inviteToken": "...", "expiresAt": ... }
   curl -X POST http://localhost:8787/invites/redeem -H 'content-type: application/json' --data-binary @redeem.json   # {"inviteToken":"...","name":"二郎","termsVersion":"<TERMS_VERSION>"}
   # → { "memberKey": "mk_..." }
   curl http://localhost:8787/members -H 'authorization: Bearer mk_...'
   ```

5. Register a print (multipart: repeat `images` per page, in page order; `childId=common` for the family-common slot). Images are served only through the API, with the same `Authorization` header:

   ```bash
   curl -X POST http://localhost:8787/prints -H 'authorization: Bearer <token>' -F childId=common -F 'title=<title.txt' -F 'images=@page1.jpg;type=image/jpeg'
   curl http://localhost:8787/images/<imageId> -H 'authorization: Bearer <token>' -o page1.jpg
   ```

6. Run the daily auto-deletion (Cron Trigger → `scheduled` in `src/worker.ts`) by hand: start with `npx wrangler dev --test-scheduled`, then `curl 'http://localhost:8787/__scheduled?cron=0+18+*+*+*'`. To make a family eligible, set its `families.last_accessed_at` more than `LIMITS.autoDeleteDays` back with `npx wrangler d1 execute kami-watashi --local --command "..."`.

   On Windows, send Japanese text from a UTF-8 file (`--data-binary @file`, or `-F 'field=<file'` in a form) rather than inline `-d '...'` / `-F field=...`: the shell re-encodes command-line arguments and the name arrives garbled.
