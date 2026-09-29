import { type QueryClient, useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'

import { apiClient } from '../api/client.ts'
import { ApiError } from '../api/errors.ts'
import { useAuthStore } from '../stores/auth.ts'
import { queryKeys } from './query-keys.ts'

type AuthStore = ReturnType<typeof useAuthStore>

/** Asking also keeps the store's owner/member in step with the API's answer. */
const launchQuery = (auth: AuthStore) => ({
  queryKey: queryKeys.launch,
  queryFn: async () => {
    const launch = await (await apiClient.launch.$post()).json()
    auth.signIn(launch.me.isOwner ? 'owner' : 'member')
    return launch
  },
})

/**
 * `POST /launch`: who this browser is (`me`) and whether it agreed to the current terms. Runs on
 * startup (`loadSignIn`) and again whenever the app comes back into view — each call marks the
 * family as in use (auto-deletion) and renews the credential cookie.
 */
export const useLaunchQuery = (queryClient?: QueryClient) => {
  const auth = useAuthStore()
  return useQuery(
    {
      ...launchQuery(auth),
      enabled: computed(() => auth.isSignedIn),
      // Once per launch/resume, not once per screen that reads `me`.
      staleTime: Infinity,
      refetchOnWindowFocus: 'always',
    },
    queryClient,
  )
}

/**
 * At startup, before the router's first navigation: whether this browser is signed in, and as
 * whom. Only the API knows (the credential cookie is HttpOnly), so this is the first launch query,
 * which `useLaunchQuery` then starts from. Unreachable (offline), it goes by the last sign-in.
 */
export const loadSignIn = async (queryClient: QueryClient, auth: AuthStore): Promise<void> => {
  try {
    // Signed out is an answer here, not a failure to report.
    await queryClient.fetchQuery({ ...launchQuery(auth), meta: { handlesError: true } })
  } catch (error) {
    if (error instanceof ApiError && error.code === 'unauthorized') auth.signOut()
    else auth.resumeLastSignIn()
  }
}
