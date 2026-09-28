import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { useRouter } from 'vue-router'

import { apiClient } from '../api/client.ts'
import { useAuthStore } from '../stores/auth.ts'
import { invalidate, queryKeys } from './query-keys.ts'

/** The family's members (`isMe` / `isOwner` flags included). */
export const useMembersQuery = (
  options: { refetchInterval?: number } = {},
  queryClient?: QueryClient,
) =>
  useQuery(
    {
      queryKey: queryKeys.members,
      queryFn: async () => (await apiClient.members.$get()).json(),
      refetchInterval: options.refetchInterval,
    },
    queryClient,
  )

/** Changes the caller's own display name (from a name dialog, which shows the failure). */
export const useRenameMeMutation = (queryClient?: QueryClient) => {
  const client = queryClient ?? useQueryClient()
  return useMutation(
    {
      mutationFn: async (name: string) => (await apiClient.me.$patch({ json: { name } })).json(),
      onSuccess: () =>
        invalidate(client, [queryKeys.members, queryKeys.launch, queryKeys.histories]),
      meta: { handlesError: true },
    },
    client,
  )
}

/** The owner removes an invited member; their device key stops working at once. */
export const useRemoveMemberMutation = (queryClient?: QueryClient) => {
  const client = queryClient ?? useQueryClient()
  return useMutation(
    {
      mutationFn: async (id: string) => {
        await apiClient.members[':id'].$delete({ param: { id } })
      },
      // Their mitene go too, which changes the prints' mitene states.
      onSuccess: () => invalidate(client, [queryKeys.members, queryKeys.prints]),
    },
    client,
  )
}

/**
 * Leaving the family for good: an invited member leaves (`DELETE /me`), or the owner withdraws,
 * deleting all of the family's data (`DELETE /family`). Either way this device's credential no
 * longer works, so it signs out, drops every cached query, and goes back to the welcome screen.
 */
export const useLeaveFamilyMutation = (queryClient?: QueryClient) => {
  const client = queryClient ?? useQueryClient()
  const auth = useAuthStore()
  const router = useRouter()
  return useMutation(
    {
      mutationFn: async () => {
        if (auth.isOwner) await apiClient.family.$delete()
        else await apiClient.me.$delete()
      },
      onSuccess: async () => {
        await auth.signOut()
        await router.replace({ name: 'welcome' })
        client.clear()
      },
    },
    client,
  )
}
