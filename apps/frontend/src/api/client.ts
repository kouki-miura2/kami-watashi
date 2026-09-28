import type { AppType } from 'backend/src/app.ts'
import { hc } from 'hono/client'

import { useAuthStore } from '../stores/auth.ts'
import { ApiError, apiErrorFromResponse } from './errors.ts'

export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787'
/** Default per-request timeout. A slow request (photo upload) passes its own `signal` via `init`. */
const REQUEST_TIMEOUT_MS = 3_000

/**
 * `fetch` that times out, and turns every failure into an `ApiError` so callers only see `ok`
 * responses. Use it directly only for endpoints outside `AppType` (`/dev/*`).
 */
export const apiFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  let response: Response
  try {
    response = await fetch(input, {
      ...init,
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
export const apiClient = hc<AppType>(API_BASE_URL, {
  fetch: apiFetch,
  headers: (): Record<string, string> => {
    const credential = useAuthStore().credential
    return credential ? { authorization: `Bearer ${credential}` } : {}
  },
})
