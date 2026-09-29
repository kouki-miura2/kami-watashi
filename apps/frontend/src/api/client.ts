import type { AppType } from 'backend/src/app.ts'
import { hc } from 'hono/client'

import { ApiError, apiErrorFromResponse } from './errors.ts'

/**
 * The API, on the web app's own origin (spec "アーキテクチャ"): deployed, the same Worker serves both;
 * in development, the Vite dev server passes `/api` on to `wrangler dev` (`vite.config.ts`).
 */
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? '/api'
/** Default per-request timeout. A slow request (photo upload) passes its own `signal` via `init`. */
const REQUEST_TIMEOUT_MS = 3_000

/**
 * `fetch` that sends the credential cookie (HttpOnly: set by the API, never seen here), times out, and turns every
 * failure into an `ApiError` so callers only see `ok` responses. Use it directly only for endpoints
 * outside `AppType` (`/dev/*`).
 */
export const apiFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  let response: Response
  try {
    response = await fetch(input, {
      ...init,
      credentials: 'include',
      signal: init?.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    // A caller's own abort (e.g. TanStack Query cancelling) is not a failure to report.
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    const timedOut = error instanceof DOMException && error.name === 'TimeoutError'
    throw new ApiError(timedOut ? 'timeout' : 'network_error', null)
  }
  if (!response.ok) throw await apiErrorFromResponse(response)
  return response
}

/** Hono RPC client. Request/response types are inferred from `AppType`, never hand-written. */
export const apiClient = hc<AppType>(API_BASE_URL, { fetch: apiFetch })
