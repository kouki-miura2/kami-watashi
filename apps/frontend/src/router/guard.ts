import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router'

interface AuthState {
  readonly isSignedIn: boolean
  readonly isOwner: boolean
}

/** Where a navigation to `to` should go instead, or `true` to allow it. Used by `router.beforeEach`. */
export const resolveNavigation = (
  to: RouteLocationNormalized,
  auth: AuthState,
): RouteLocationRaw | true => {
  if (!to.meta.public && !auth.isSignedIn) return { name: 'welcome' }
  if (to.meta.public && auth.isSignedIn) return { name: 'home' }
  if (to.meta.ownerOnly && !auth.isOwner) return { name: 'home' }
  return true
}
