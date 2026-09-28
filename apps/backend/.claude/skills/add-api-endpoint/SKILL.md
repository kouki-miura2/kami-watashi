---
name: add-api-endpoint
description: Add a new API endpoint to apps/backend, following the route -> service -> repository -> dao layering with co-located tests at every layer. Use when adding, wiring, or scaffolding a new backend route/endpoint, or when asked how a backend endpoint should be structured.
---

# Add a backend API endpoint

`apps/backend` request handling is strictly layered (see `apps/backend/AGENTS.md`):

```
route (src/route/*.route.ts) -> service (src/service/*.service.ts)
                             -> repository (src/repository/*.repository.ts)
                             -> dao (src/dao/*.interface.ts;
                                     implementations in the runtime package, e.g. *.d1.ts)
```

- A **route** depends only on a service. No business logic or datastore access in a route file.
- A **service** holds business logic, orchestrates one or more repositories, and is the only
  layer that decides outcomes like "not found" / validation. It knows nothing about HTTP.
- A **repository** maps a DAO's raw storage shape to a domain entity. No datastore access here
  either — that's the DAO's job.
- A **dao** is the only layer that talks to a datastore, behind an interface, so different
  runtime packages (`apps/backend-*`) can wire in their own concrete DAOs without touching service/repository/route code.
  DAO methods are cut per operation, not per table: a write spanning several tables (plus its
  history row) is one method, so the runtime can run it atomically (D1 `batch()`).

Topics are the simplest complete example of this chain — read it before starting and copy its
shape rather than inventing a new one: `src/route/topics.route.ts` → `src/service/topic.service.ts`
→ `src/repository/topic.repository.ts` → `src/dao/topic.interface.ts` →
`apps/backend-worker/src/dao/topic.d1.ts`, each with its co-located test.

## Procedure

Build bottom-up — each layer's test needs the layer below it to already have an interface.
Replace `<name>` below with the resource name (e.g. `widget`), matching the `topic.*` naming
scheme.

### 1. DAO layer

- `src/dao/<name>.interface.ts` — the raw storage type (`<Name>Record`) and the `<Name>Dao`
  interface (the methods this endpoint needs, e.g. `findById`).
- No in-memory implementation here. The concrete DAO lives in the runtime package
  (`apps/backend-worker/src/dao/<name>.d1.ts` / `.r2.ts`, see that package's `AGENTS.md`),
  with its own co-located test there.

### 2. Repository layer

- `src/repository/<name>.repository.ts` — the domain entity type (`<Name>`), the
  `<Name>Repository` interface, and `create<Name>Repository(dao)` mapping the DAO's raw record to
  the domain entity.
- `src/repository/<name>.repository.test.ts` — co-located test, using a hand-written fake
  `<Name>Dao` (not a real implementation) so the test only exercises the repository's
  mapping logic (see `topic.repository.test.ts`).

### 3. Service layer

- `src/service/<name>.service.ts` — the response/view type the route will return (`<Name>View`),
  the `<Name>Service` interface, and `create<Name>Service(repository)` implementing the business
  logic and orchestration. Express "not found" / "invalid" as `null` or a thrown error — never an
  HTTP status here.
- `src/service/<name>.service.test.ts` — co-located test, using a hand-written fake
  `<Name>Repository` (see `topic.service.test.ts`).

### 4. Route layer (`src/route/<name>.route.ts`)

- Add the new dependency to `AppDependencies` in `src/app.ts` (e.g. `<name>Service: <Name>Service`).
- `src/route/<name>.route.ts` — `create<Name>Routes(deps)` returning a Hono sub-app. Each handler
  validates input with `zValidator` from `@hono/zod-validator` (shape and `LIMITS`-based input
  limits; this also gives Hono RPC the request types), calls only the service, and translates its
  result to an HTTP response (status code, JSON body). No business logic in the route itself.
- Chain it into `createApp(...)` in `src/app.ts` with `.route('/<path>', create<Name>Routes(deps))`
  — keep it in the chain so `AppType` still carries the new route's types.
- `src/route/<name>.route.test.ts` — co-located test using a hand-written fake `<Name>Service`,
  covering the success path, the "not found"/error path, validation errors, and auth guard
  interaction if the route isn't excluded from it.

### 5. Wire real dependencies

- Add the datastore-backed DAO in the runtime package (`apps/backend-worker/src/dao/<name>.d1.ts`,
  with a `<name>.d1.test.ts` against the local D1 from `createTestD1()`).
- Update the runtime package's entrypoint (`apps/backend-worker/src/worker.ts`) to construct the
  real dao -> repository -> service chain and pass it into `createApp`, the same way it already
  does for `topicService`.
- Add the new service to `createTestApp`'s defaults in `src/testing.ts`.

### 6. Validate

```bash
vp check   # format, lint, type check
vp test    # or: vp run backend#test
```

## Notes

- Every file has its test right next to it (`foo.ts` + `foo.test.ts`) — never a separate `test/`
  or `__tests__/` tree.
- Each layer's test fakes only the interface directly below it, not the real implementation, so
  layers stay independently testable. The DAO's own test (in the runtime package) is the only
  one that touches a real implementation.
