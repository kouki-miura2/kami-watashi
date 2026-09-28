import type { Router } from 'vue-router'

import { ApiError, errorMessage } from './errors.ts'

/** `meta` accepted by every query and mutation (`useQuery({ meta })` / `useMutation({ meta })`). */
export interface RequestMeta extends Record<string, unknown> {
  /** The caller shows this failure itself (inline, in a dialog), so skip the app-wide snackbar. */
  handlesError?: boolean
}

declare module '@tanstack/vue-query' {
  interface Register {
    queryMeta: RequestMeta
    mutationMeta: RequestMeta
  }
}

interface ErrorHandlerDeps {
  auth: { readonly isSignedIn: boolean; readonly isMember: boolean; signOut: () => Promise<void> }
  router: Pick<Router, 'replace'>
  /** Drops every cached query: nothing fetched with the old credential may outlive it. */
  clearCache: () => void
  notify: (message: string) => void
}

/**
 * The one place a failed query or mutation is reported (wired into the `QueryCache` /
 * `MutationCache` in `main.ts`):
 * - A rejected credential signs this device out. An invited member's key only stops working when
 *   they were removed or the family was deleted, so they get the "removed" screen; an owner
 *   (expired session) goes back to the welcome screen to sign in with Google again.
 * - `terms_required` (the terms were revised) opens the terms screen to agree again.
 * - Anything else shows its message in the snackbar, unless the caller handles it (`handlesError`).
 */
export const createApiErrorHandler =
  (deps: ErrorHandlerDeps) =>
  async (error: unknown, meta: RequestMeta | undefined): Promise<void> => {
    if (error instanceof ApiError && error.code === 'unauthorized' && deps.auth.isSignedIn) {
      const wasMember = deps.auth.isMember
      await deps.auth.signOut()
      await deps.router.replace({ name: wasMember ? 'removed' : 'welcome' })
      deps.clearCache()
      return
    }
    if (error instanceof ApiError && error.code === 'terms_required') {
      await deps.router.replace({ name: 'terms' })
      return
    }
    if (meta?.handlesError) return
    deps.notify(errorMessage(error))
  }
