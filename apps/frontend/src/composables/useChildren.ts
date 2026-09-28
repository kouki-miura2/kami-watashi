import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'

import { apiClient } from '../api/client.ts'
import { invalidate, queryKeys } from './query-keys.ts'

/**
 * `GET /children`: every slot (the family-common slot and each child) with this week's count and
 * the caller's mitene badge. Refetched when the app returns to the foreground (TanStack Query's
 * default `refetchOnWindowFocus`), which is when the spec refreshes the mitene counts.
 */
export const useChildrenQuery = (queryClient?: QueryClient) =>
  useQuery(
    {
      queryKey: queryKeys.children,
      queryFn: async () => (await apiClient.children.$get()).json(),
    },
    queryClient,
  )

// Adding and renaming run from a name dialog, which shows the failure (e.g. `name_taken`) itself.

export const useCreateChildMutation = (queryClient?: QueryClient) => {
  const client = queryClient ?? useQueryClient()
  return useMutation(
    {
      mutationFn: async (name: string) =>
        (await apiClient.children.$post({ json: { name } })).json(),
      onSuccess: () =>
        invalidate(client, [queryKeys.children, queryKeys.histories, queryKeys.stats]),
      meta: { handlesError: true },
    },
    client,
  )
}

export const useRenameChildMutation = (queryClient?: QueryClient) => {
  const client = queryClient ?? useQueryClient()
  return useMutation(
    {
      mutationFn: async ({ id, name }: { id: string; name: string }) =>
        (await apiClient.children[':id'].$patch({ param: { id }, json: { name } })).json(),
      onSuccess: () =>
        invalidate(client, [queryKeys.children, queryKeys.histories, queryKeys.stats]),
      meta: { handlesError: true },
    },
    client,
  )
}

/** Deletes a child with all their prints and photos. */
export const useDeleteChildMutation = (queryClient?: QueryClient) => {
  const client = queryClient ?? useQueryClient()
  return useMutation(
    {
      mutationFn: async (id: string) => {
        await apiClient.children[':id'].$delete({ param: { id } })
      },
      onSuccess: () =>
        invalidate(client, [
          queryKeys.children,
          queryKeys.prints,
          queryKeys.histories,
          queryKeys.stats,
        ]),
    },
    client,
  )
}

/**
 * How many prints a slot (`slotParam`) has, fetched fresh: the first confirmation of a child's
 * deletion tells how many prints go with them.
 */
export const useFetchSlotPrintCount = (queryClient?: QueryClient) => {
  const client = queryClient ?? useQueryClient()
  return async (slot: string): Promise<number> => {
    const prints = await client.fetchQuery({
      queryKey: [...queryKeys.prints, slot, {}],
      queryFn: async () => (await apiClient.prints.$get({ query: { child: slot } })).json(),
    })
    return prints.length
  }
}
