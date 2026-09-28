import { type QueryClient, useMutation, useQueryClient } from '@tanstack/vue-query'

import { apiClient } from '../api/client.ts'
import { TERMS_VERSION } from '../terms.ts'
import { queryKeys } from './query-keys.ts'

/** Agrees to the revised terms (`TERMS_VERSION`) for a member who already uses the app. */
export const useAgreeTermsMutation = (queryClient?: QueryClient) => {
  const client = queryClient ?? useQueryClient()
  return useMutation(
    {
      mutationFn: async () => {
        await apiClient.me.terms.$post({ json: { termsVersion: TERMS_VERSION } })
      },
      onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.launch }),
    },
    client,
  )
}
