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

Runs `apps/backend` on Cloudflare Workers.

- Debug locally (reloads on changes in `apps/backend` too):

```bash
vp run backend-worker#dev
```

- Build (dry-run bundle):

```bash
vp run backend-worker#build
```

- Deploy:

```bash
vp run backend-worker#deploy
```

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
