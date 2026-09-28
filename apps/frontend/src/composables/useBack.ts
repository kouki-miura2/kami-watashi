import { type RouteLocationRaw, useRouter } from 'vue-router'

/**
 * Back navigation for a screen's back/close button: to the previous screen, or to `fallback`
 * when the screen was opened directly (nothing to go back to).
 */
export const useBack = (fallback: RouteLocationRaw) => {
  const router = useRouter()
  return () => (window.history.state?.back ? router.back() : router.replace(fallback))
}
