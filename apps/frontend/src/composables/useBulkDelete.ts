import { type QueryClient, useMutation, useQueries, useQueryClient } from '@tanstack/vue-query'
import { LIMITS } from 'utils'

import { apiClient } from '../api/client.ts'
import { invalidate, queryKeys } from './query-keys.ts'

/** The bulk-deletion choices (`LIMITS.bulkDeleteMonths`), each with how much it would delete. */
export const useBulkDeleteCountsQuery = (queryClient?: QueryClient) =>
  useQueries(
    {
      queries: LIMITS.bulkDeleteMonths.map((months) => ({
        queryKey: [...queryKeys.prints, 'bulk-delete', months],
        queryFn: async () => ({
          months,
          ...(await (
            await apiClient.prints['bulk-delete'].$get({
              query: { olderThanMonths: String(months) },
            })
          ).json()),
        }),
      })),
    },
    queryClient,
  )

/** Deletes every print registered at least `months` ago, across all slots. */
export const useBulkDeleteMutation = (queryClient?: QueryClient) => {
  const client = queryClient ?? useQueryClient()
  return useMutation(
    {
      mutationFn: async (months: number) =>
        (await apiClient.prints['bulk-delete'].$post({ json: { olderThanMonths: months } })).json(),
      onSuccess: () =>
        invalidate(client, [
          queryKeys.children,
          queryKeys.prints,
          queryKeys.topics,
          queryKeys.histories,
          queryKeys.stats,
        ]),
    },
    client,
  )
}
