# packages/utils

- Date/time helpers: shared date manipulation/formatting/parsing functions.
- Limits: `LIMITS` holds every app-wide limit (storage quota, member count, photos/topics per print, photo resize size). Never hard-code these numbers elsewhere; the "リミット値" table in `docs/spec.md` mirrors this file.
- Logger: a thin wrapper over `console.*` (log levels, prefixing, env-aware). Application code calls the logger, never `console.log` directly.
