import { type QueryClient, useMutation } from '@tanstack/vue-query'

import { apiClient } from '../api/client.ts'

/**
 * Issues an invite token for the QR code (owners only). Fails with `member_limit` when the family
 * is full, which the invite screen shows in place of the QR code.
 */
export const useCreateInviteMutation = (queryClient?: QueryClient) =>
  useMutation(
    {
      mutationFn: async () => (await apiClient.invites.$post()).json(),
      meta: { handlesError: true },
    },
    queryClient,
  )
