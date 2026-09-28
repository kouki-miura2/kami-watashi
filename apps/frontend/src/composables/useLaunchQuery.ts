import { type QueryClient, useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'

import { apiClient } from '../api/client.ts'
import { useAuthStore } from '../stores/auth.ts'
import { queryKeys } from './query-keys.ts'

/**
 * `POST /launch`: who this device is (`me`) and whether it agreed to the current terms. Runs on
 * startup and again whenever the app returns to the foreground — each call marks the family as in
 * use (auto-deletion) and extends the owner's session, whose renewed token replaces the saved one.
 */
export const useLaunchQuery = (queryClient?: QueryClient) => {
  const auth = useAuthStore()
  return useQuery(
    {
      queryKey: queryKeys.launch,
      queryFn: async () => {
        const launch = await (await apiClient.launch.$post()).json()
        if (launch.session) await auth.signIn(launch.session.sessionToken)
        return launch
      },
      enabled: computed(() => auth.isSignedIn),
      // Once per launch/resume, not once per screen that reads `me`.
      staleTime: Infinity,
      refetchOnWindowFocus: 'always',
    },
    queryClient,
  )
}
