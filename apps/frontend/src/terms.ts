/**
 * The terms of use / privacy policy version this app shows and asks to agree to. Registration and
 * joining happen before the app can ask the API, so it must equal the API's `TERMS_VERSION`
 * (`apps/backend-worker/wrangler.jsonc`) — change both together when the terms are revised. A
 * mismatch fails with `invalid_terms_version` ("update the app").
 */
export const TERMS_VERSION = '2026-10-01'
