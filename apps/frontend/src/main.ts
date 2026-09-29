import { MutationCache, QueryCache, QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { createPinia } from 'pinia'
import { createApp } from 'vue'

import { createApiErrorHandler } from './api/error-handler.ts'
import App from './App.vue'
import { revokeImageUrlsOnRemoval } from './composables/useImageQuery.ts'
import { loadSignIn } from './composables/useLaunchQuery.ts'
import { vuetify } from './plugins/vuetify.ts'
import { router } from './router/index.ts'
import { useAuthStore } from './stores/auth.ts'
import { useInstallStore } from './stores/install.ts'
import { useNotificationStore } from './stores/notification.ts'

const pinia = createPinia()
const auth = useAuthStore(pinia)
const notification = useNotificationStore(pinia)
// Now, before any `await`: the browser offers the install right after the page loads.
useInstallStore(pinia)

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

// Before `use(router)`: its first navigation runs the auth guard, which needs to know whether this
// browser is signed in.
await loadSignIn(queryClient, auth)

createApp(App)
  .use(pinia)
  .use(router)
  .use(vuetify)
  .use(VueQueryPlugin, { queryClient })
  .mount('#app')
