# utils

Shared runtime utilities used by `apps/backend` and `apps/frontend`.

- `date` — date formatting (`formatDate`) and calculation (`addDays`, `addMonths`, `addYears`, `startOfDay`, `endOfDay`, `isSameDay`, `diffInDays`) helpers, built on the native `Date` API only. These use the runtime's local time zone; for the app's day/week/month boundaries use the JST helpers (`toJstDateString`, `startOfJstWeek`, `startOfJstMonth`, `addJstMonths`), since the spec fixes them to Asia/Tokyo.
- `limits` — `LIMITS`, the app-wide limits (storage quota, family members, photos/topics per print, photo resize size).
- `text` — `charLength()` / `truncateChars()`, the character count used for the name/title limits (every visible character counts as one, full-width or half-width).
- `logger` — `createLogger()`, a thin wrapper over `console.*` with level filtering and an optional prefix.

Consumed directly from source (`apps/backend`, `apps/frontend` resolve `utils` to `src/index.ts`) — no build step needed.

## Development

- Run the unit tests:

```bash
vp test
```
