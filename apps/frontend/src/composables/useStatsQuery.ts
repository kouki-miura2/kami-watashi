import { type QueryClient, useQuery } from '@tanstack/vue-query'

import { apiClient } from '../api/client.ts'
import { queryKeys } from './query-keys.ts'

/** `GET /stats`: registrations per week/month per slot, and the family's storage use. */
export const useStatsQuery = (queryClient?: QueryClient) =>
  useQuery(
    {
      queryKey: queryKeys.stats,
      queryFn: async () => (await apiClient.stats.$get()).json(),
    },
    queryClient,
  )
