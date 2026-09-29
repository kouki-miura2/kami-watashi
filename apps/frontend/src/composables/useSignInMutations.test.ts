import { QueryClient } from '@tanstack/vue-query'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, expect, test, vi } from 'vite-plus/test'
import { effectScope } from 'vue'

import { apiClient, apiFetch } from '../api/client.ts'
import { ApiError } from '../api/errors.ts'
import { useAuthStore } from '../stores/auth.ts'
import { TERMS_VERSION } from '../terms.ts'
import {
  useDevLoginMutation,
  useGoogleLoginMutation,
  useRedeemInviteMutation,
  useRegisterOwnerMutation,
} from './useSignInMutations.ts'

vi.mock('../api/client.ts', () => ({
  API_BASE_URL: 'http://api.test',
  apiFetch: vi.fn(),
  apiClient: {
    auth: { google: { $post: vi.fn(), register: { $post: vi.fn() } } },
    invites: { redeem: { $post: vi.fn() } },
  },
}))

const queryClient = new QueryClient()
const inScope = <T>(create: (client: QueryClient) => T): T =>
  effectScope().run(() => create(queryClient))!

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

test('Google login signs in when the account has a family', async () => {
  vi.mocked(apiClient.auth.google.$post).mockResolvedValue(
    new Response(null, { status: 204 }) as never,
  )
  const login = inScope(useGoogleLoginMutation)

  await expect(login.mutateAsync('id-token')).resolves.toEqual({ status: 'signed-in' })

  expect(apiClient.auth.google.$post).toHaveBeenCalledWith({ json: { idToken: 'id-token' } })
  expect(useAuthStore().isOwner).toBe(true)
})

test('Google login hands back a pending registration when the account has no family', async () => {
  vi.mocked(apiClient.auth.google.$post).mockRejectedValue(
    new ApiError('not_registered', 404, { suggestedName: '一郎' }),
  )
  const login = inScope(useGoogleLoginMutation)

  await expect(login.mutateAsync('id-token')).resolves.toEqual({
    status: 'not-registered',
    registration: { idToken: 'id-token', suggestedName: '一郎' },
  })
  expect(useAuthStore().isSignedIn).toBe(false)
})

test('registering an owner agrees to the current terms and signs in', async () => {
  vi.mocked(apiClient.auth.google.register.$post).mockResolvedValue(
    new Response(null, { status: 204 }) as never,
  )
  const register = inScope(useRegisterOwnerMutation)

  await register.mutateAsync({ idToken: 'id-token', name: '一郎' })

  expect(apiClient.auth.google.register.$post).toHaveBeenCalledWith({
    json: { idToken: 'id-token', name: '一郎', termsVersion: TERMS_VERSION },
  })
  expect(useAuthStore().isOwner).toBe(true)
})

test('redeeming an invite signs in as a member', async () => {
  vi.mocked(apiClient.invites.redeem.$post).mockResolvedValue(
    new Response(null, { status: 204 }) as never,
  )
  const redeem = inScope(useRedeemInviteMutation)

  await redeem.mutateAsync({ inviteToken: 'invite', name: '二郎' })

  expect(apiClient.invites.redeem.$post).toHaveBeenCalledWith({
    json: { inviteToken: 'invite', name: '二郎', termsVersion: TERMS_VERSION },
  })
  expect(useAuthStore().isMember).toBe(true)
  // The view shows redeem failures next to the step they belong to, not in the snackbar.
  expect(queryClient.getMutationCache().getAll().at(-1)?.meta).toEqual({ handlesError: true })
})

test('dev login posts to /dev/login and signs in', async () => {
  vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 204 }))
  const devLogin = inScope(useDevLoginMutation)

  await devLogin.mutateAsync({ googleSub: 'dev-owner-1', name: '一郎' })

  const [url, init] = vi.mocked(apiFetch).mock.calls[0]!
  expect(url).toBe('http://api.test/dev/login')
  expect(init?.body).toBe(JSON.stringify({ googleSub: 'dev-owner-1', name: '一郎' }))
  expect(useAuthStore().isOwner).toBe(true)
})
