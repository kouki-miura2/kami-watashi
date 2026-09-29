import { type QueryClient, useMutation } from '@tanstack/vue-query'

import { apiClient, apiFetch, API_BASE_URL } from '../api/client.ts'
import { ApiError } from '../api/errors.ts'
import { useAuthStore } from '../stores/auth.ts'
import { TERMS_VERSION } from '../terms.ts'

/** An owner whose Google account has no family yet, on the way to registering one. */
export interface PendingRegistration {
  idToken: string
  /** The Google account's name cut to the name limit: the display name's initial value. */
  suggestedName: string
}

const suggestedNameOf = (details: unknown): string =>
  typeof details === 'object' &&
  details !== null &&
  'suggestedName' in details &&
  typeof details.suggestedName === 'string'
    ? details.suggestedName
    : ''

export type GoogleLoginOutcome =
  | { status: 'signed-in' }
  /** The account has no family yet: the caller continues to the terms and name steps. */
  | { status: 'not-registered'; registration: PendingRegistration }

/** Owner sign-in with the ID token from Google's button (`googleSignIn.renderButton`). */
export const useGoogleLoginMutation = (queryClient?: QueryClient) => {
  const auth = useAuthStore()
  return useMutation(
    {
      mutationFn: async (idToken: string): Promise<GoogleLoginOutcome> => {
        try {
          await apiClient.auth.google.$post({ json: { idToken } })
          auth.signIn('owner')
          return { status: 'signed-in' }
        } catch (error) {
          if (error instanceof ApiError && error.code === 'not_registered') {
            return {
              status: 'not-registered',
              registration: { idToken, suggestedName: suggestedNameOf(error.details) },
            }
          }
          throw error
        }
      },
    },
    queryClient,
  )
}

/** Owner registration: creates the family (agreeing to `TERMS_VERSION`) and signs in. */
export const useRegisterOwnerMutation = (queryClient?: QueryClient) => {
  const auth = useAuthStore()
  return useMutation(
    {
      mutationFn: async (input: { idToken: string; name: string }) => {
        await apiClient.auth.google.register.$post({
          json: { ...input, termsVersion: TERMS_VERSION },
        })
        auth.signIn('owner')
      },
    },
    queryClient,
  )
}

/**
 * Joins a family with the invite token from the owner's QR code (agreeing to `TERMS_VERSION`); the
 * API keeps the member key in the credential cookie. The caller shows failures itself,
 * next to the step they belong to (the invite code, or the name).
 */
export const useRedeemInviteMutation = (queryClient?: QueryClient) => {
  const auth = useAuthStore()
  return useMutation(
    {
      mutationFn: async (input: { inviteToken: string; name: string }) => {
        await apiClient.invites.redeem.$post({
          json: { ...input, termsVersion: TERMS_VERSION },
        })
        auth.signIn('member')
      },
      meta: { handlesError: true },
    },
    queryClient,
  )
}

/**
 * Local development only: signs in as the owner with this `googleSub`, creating the family on
 * first use, without Google (`POST /dev/login`, which the API mounts only when `DEV_LOGIN_ENABLED`).
 */
export const useDevLoginMutation = (queryClient?: QueryClient) => {
  const auth = useAuthStore()
  return useMutation(
    {
      mutationFn: async (input: { googleSub: string; name: string }) => {
        await apiFetch(`${API_BASE_URL}/dev/login`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        })
        auth.signIn('owner')
      },
    },
    queryClient,
  )
}
