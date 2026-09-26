# apps/backend-worker

- Cloudflare Workers entrypoint for `apps/backend`. `src/worker.ts` wires concrete dependencies (DAO → repository → service) into `createApp` from `backend/src/app.ts` and exports the app; routes and business logic stay in `apps/backend`.
- Workers-only code lives here, never in `apps/backend`: DAOs backed by Cloudflare bindings (`src/dao/*.d1.ts`, KV, R2, ...) implementing the interfaces in `backend/src/dao/*.interface.ts`, and anything that touches `env` bindings.
- Config is `wrangler.jsonc`. After adding bindings, run `vp run backend-worker#cf-typegen` to regenerate `worker-configuration.d.ts` (untracked).
- Secrets: use `wrangler secret put`, never `.env` / commit `.dev.vars`.
