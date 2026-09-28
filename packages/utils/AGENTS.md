# packages/utils

- Date/time helpers: shared date manipulation/formatting/parsing functions. The spec fixes day/week/month boundaries to JST regardless of device or server time zone, so app logic uses `date/jst.ts`, not the local-time helpers in `date/calc.ts`.
- Text: `charLength` is how every name/title length limit is counted (grapheme clusters: every visible character is one, full-width or half-width) — use it instead of `.length`.
- Limits: `LIMITS` holds every app-wide limit (storage quota, member count, photos/topics per print, photo resize size). Never hard-code these numbers elsewhere; the "リミット値" table in `docs/spec.md` mirrors this file.
- Logger: a thin wrapper over `console.*` (log levels, prefixing, env-aware). Application code calls the logger, never `console.log` directly.
