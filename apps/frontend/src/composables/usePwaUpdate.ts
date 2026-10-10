import { useRegisterSW } from 'virtual:pwa-register/vue'
import { onScopeDispose } from 'vue'

const CHECK_INTERVAL_MS = 60 * 60 * 1000

/** Called once from App.vue. New builds wait for 「更新」, preserving unfinished forms. */
export const usePwaUpdate = () => {
  let disposed = false
  let stopChecking: (() => void) | undefined
  const { needRefresh, updateServiceWorker } = useRegisterSW({
    onRegisteredSW: (_url, registration) => {
      if (!registration || disposed) return
      stopChecking?.()
      // Offline failures are retried on the next check.
      const check = () => void registration.update().catch(() => {})
      const onVisible = () => {
        if (document.visibilityState === 'visible') check()
      }
      document.addEventListener('visibilitychange', onVisible)
      const timer = setInterval(check, CHECK_INTERVAL_MS)
      stopChecking = () => {
        document.removeEventListener('visibilitychange', onVisible)
        clearInterval(timer)
      }
    },
  })
  onScopeDispose(() => {
    disposed = true
    stopChecking?.()
  })

  const update = () => void updateServiceWorker()
  return { needRefresh, update }
}
