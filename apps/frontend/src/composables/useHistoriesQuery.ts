import { type QueryClient, useInfiniteQuery } from '@tanstack/vue-query'

import { apiClient } from '../api/client.ts'
import { queryKeys } from './query-keys.ts'

/**
 * `GET /histories`, newest first, `LIMITS.historyPageSize` per page; `fetchNextPage` continues
 * from the previous page's `nextCursor` until it is `null`.
 */
export const useHistoriesQuery = (queryClient?: QueryClient) =>
  useInfiniteQuery(
    {
      queryKey: queryKeys.histories,
      queryFn: async ({ pageParam }) =>
        (await apiClient.histories.$get({ query: pageParam ? { cursor: pageParam } : {} })).json(),
      initialPageParam: null as string | null,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
    queryClient,
  )
