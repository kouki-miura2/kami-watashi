import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'

import { apiClient } from '../api/client.ts'
import { invalidate, queryKeys } from './query-keys.ts'

/** `GET /topics`: the family's topics by name, each with how many prints it is set on. */
export const useTopicsQuery = (queryClient?: QueryClient) =>
  useQuery(
    {
      queryKey: queryKeys.topics,
      queryFn: async () => (await apiClient.topics.$get()).json(),
    },
    queryClient,
  )

// Adding and renaming run from a name dialog, which shows the failure (e.g. `name_taken`) itself.

export const useCreateTopicMutation = (queryClient?: QueryClient) => {
  const client = queryClient ?? useQueryClient()
  return useMutation(
    {
      mutationFn: async (name: string) => (await apiClient.topics.$post({ json: { name } })).json(),
      onSuccess: () => invalidate(client, [queryKeys.topics, queryKeys.histories]),
      meta: { handlesError: true },
    },
    client,
  )
}

export const useRenameTopicMutation = (queryClient?: QueryClient) => {
  const client = queryClient ?? useQueryClient()
  return useMutation(
    {
      mutationFn: async ({ id, name }: { id: string; name: string }) =>
        (await apiClient.topics[':id'].$patch({ param: { id }, json: { name } })).json(),
      onSuccess: () =>
        invalidate(client, [queryKeys.topics, queryKeys.prints, queryKeys.histories]),
      meta: { handlesError: true },
    },
    client,
  )
}

/** Deletes a topic; it comes off every print. */
export const useDeleteTopicMutation = (queryClient?: QueryClient) => {
  const client = queryClient ?? useQueryClient()
  return useMutation(
    {
      mutationFn: async (id: string) => {
        await apiClient.topics[':id'].$delete({ param: { id } })
      },
      onSuccess: () =>
        invalidate(client, [queryKeys.topics, queryKeys.prints, queryKeys.histories]),
    },
    client,
  )
}
