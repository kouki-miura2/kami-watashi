# Kami-watashi

Solution for sharing notices among family members.

## Development

- Check everything is ready:

```bash
vp run ready
```

- Run all tests:

```bash
vp run -r test
```

- Build everything:

```bash
vp run -r build
```

## packages/utils

- Run format/lint/type checks:

```bash
vp run utils#check
```

- Run the tests:

```bash
vp run utils#test
```

## apps/backend

Runtime-agnostic routes and business logic. Run it through `apps/backend-worker` or `apps/backend-node`.

- Run format/lint/type checks:

```bash
vp run backend#check
```

- Run the tests:

```bash
vp run backend#test
```

## apps/backend-worker

Runs `apps/backend` on Cloudflare Workers, and serves the web app (`apps/frontend`'s build) from the same Worker and origin: the web app at `/`, the API under `/api`. `dev`, `build` and `deploy` build the web app first.

- Debug locally (reloads on changes in `apps/backend` too):

```bash
vp run backend-worker#dev
```

- Build (dry-run bundle):

```bash
vp run backend-worker#build
```

- Deploy (the web app and the API together):

```bash
vp run backend-worker#deploy
```

The first time, after `vp exec wrangler login` (in `apps/backend-worker`): set the secrets before deploying (the Worker refuses to start without `SESSION_SECRET`; setting a secret creates the Worker), deploy (which creates the D1 database and the R2 bucket), then apply the migrations. Add the app's URL (`https://<name>.<account subdomain>.workers.dev`) to the web OAuth client's authorized JavaScript origins in Google Cloud Console.

```bash
vp exec wrangler secret put SESSION_SECRET      # a long random string
vp exec wrangler secret put GOOGLE_CLIENT_IDS   # the web OAuth client id
vp run backend-worker#deploy
vp run backend-worker#db:migrate:remote
```

The Google client id for the web app's build goes in `apps/frontend/.env.local` (`VITE_GOOGLE_WEB_CLIENT_ID`).

- Regenerate Workers binding types:

```bash
vp run backend-worker#cf-typegen
```

## apps/frontend

- Run format/lint/type checks:

```bash
vp run frontend#check
```

- Run the tests:

```bash
vp run frontend#test
```

- Run the dev server:

```bash
vp run frontend#dev
```

- Build:

```bash
vp run frontend#build
```

- Preview the production build:

```bash
vp run frontend#preview
```

### Trying the app locally

The web app runs in the browser against the local API.

1. Start the local API on port 8787, with `apps/backend-worker/.dev.vars` set up as in `apps/backend-worker/AGENTS.md` (`DEV_LOGIN_ENABLED=true`):

   ```bash
   vp run backend-worker#db:migrate:local
   vp run backend-worker#dev
   ```

2. In another terminal, start the dev server and open http://localhost:5173 in Chrome, Edge or Firefox (the API's sign-in cookie is `Secure`, which these allow on `http://localhost`; Safari doesn't):

   ```bash
   vp run frontend#dev
   ```

3. Sign in with the welcome screen's development login.

Settings of your own environment (such as the Google client id) go in gitignored `apps/frontend/.env.local`, never in tracked files; `apps/frontend/.env` lists them.
