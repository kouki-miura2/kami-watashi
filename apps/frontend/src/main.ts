import { App as CapacitorApp } from '@capacitor/app'
import {
  focusManager,
  MutationCache,
  QueryCache,
  QueryClient,
  VueQueryPlugin,
} from '@tanstack/vue-query'
import { createPinia } from 'pinia'
import { createApp } from 'vue'

import { createApiErrorHandler } from './api/error-handler.ts'
import App from './App.vue'
import { revokeImageUrlsOnRemoval } from './composables/useImageQuery.ts'
import { vuetify } from './plugins/vuetify.ts'
import { router } from './router/index.ts'
import { useAuthStore } from './stores/auth.ts'
import { useConnectivityStore } from './stores/connectivity.ts'
import { useNotificationStore } from './stores/notification.ts'

const pinia = createPinia()
const auth = useAuthStore(pinia)
const notification = useNotificationStore(pinia)

const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError: (error, query) => handleApiError(error, query.meta) }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _onMutateResult, mutation) => handleApiError(error, mutation.meta),
  }),
  // `retry: false`: without it, TanStack Query's default of 3 retries with exponential backoff
  // turns one 3s-timeout request into ~20s before the error surfaces.
  defaultOptions: { queries: { retry: false } },
})
const handleApiError = createApiErrorHandler({
  auth,
  router,
  clearCache: () => queryClient.clear(),
  notify: notification.show,
})
revokeImageUrlsOnRemoval(queryClient)

// "Focus" is the app coming back to the foreground (`appStateChange` also covers the browser's
// tab visibility): queries marked `refetchOnWindowFocus` (launch, mitene counts) refetch then.
focusManager.setEventListener((setFocused) => {
  const listener = CapacitorApp.addListener('appStateChange', ({ isActive }) =>
    setFocused(isActive),
  )
  return () => void listener.then((handle) => handle.remove())
})

// Before `use(router)`: its first navigation runs the auth guard, which needs the saved credential.
await auth.restore()
await useConnectivityStore(pinia).start()

createApp(App)
  .use(pinia)
  .use(router)
  .use(vuetify)
  .use(VueQueryPlugin, { queryClient })
  .mount('#app')
