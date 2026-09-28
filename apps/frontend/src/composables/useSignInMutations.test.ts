import { QueryClient } from '@tanstack/vue-query'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, expect, test, vi } from 'vite-plus/test'
import { effectScope } from 'vue'

import { apiClient, apiFetch } from '../api/client.ts'
import { ApiError } from '../api/errors.ts'
import { googleSignIn } from '../api/google-sign-in.ts'
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
vi.mock('../api/google-sign-in.ts', () => ({
  googleSignIn: { available: true, getIdToken: vi.fn(async () => 'id-token') },
}))
vi.mock('../api/credential-storage.ts', () => ({
  credentialStorage: { load: vi.fn(), save: vi.fn(), clear: vi.fn() },
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
    Response.json({ sessionToken: 'session', expiresAt: 1 }) as never,
  )
  const login = inScope(useGoogleLoginMutation)

  await expect(login.mutateAsync()).resolves.toEqual({ status: 'signed-in' })

  expect(apiClient.auth.google.$post).toHaveBeenCalledWith({ json: { idToken: 'id-token' } })
  expect(useAuthStore().credential).toBe('session')
})

test('Google login hands back a pending registration when the account has no family', async () => {
  vi.mocked(apiClient.auth.google.$post).mockRejectedValue(
    new ApiError('not_registered', 404, { suggestedName: '一郎' }),
  )
  const login = inScope(useGoogleLoginMutation)

  await expect(login.mutateAsync()).resolves.toEqual({
    status: 'not-registered',
    registration: { idToken: 'id-token', suggestedName: '一郎' },
  })
  expect(useAuthStore().isSignedIn).toBe(false)
})

test('Google login backed out of on the device just reports cancelled', async () => {
  vi.mocked(googleSignIn.getIdToken).mockResolvedValueOnce(null)
  const login = inScope(useGoogleLoginMutation)

  await expect(login.mutateAsync()).resolves.toEqual({ status: 'cancelled' })
  expect(apiClient.auth.google.$post).not.toHaveBeenCalled()
})

test('Google login fails when sign-in on the device fails', async () => {
  vi.mocked(googleSignIn.getIdToken).mockRejectedValueOnce(new Error('network down'))
  const login = inScope(useGoogleLoginMutation)

  await expect(login.mutateAsync()).rejects.toThrow('network down')
})

test('registering an owner agrees to the current terms and signs in', async () => {
  vi.mocked(apiClient.auth.google.register.$post).mockResolvedValue(
    Response.json({ sessionToken: 'session', expiresAt: 1 }) as never,
  )
  const register = inScope(useRegisterOwnerMutation)

  await register.mutateAsync({ idToken: 'id-token', name: '一郎' })

  expect(apiClient.auth.google.register.$post).toHaveBeenCalledWith({
    json: { idToken: 'id-token', name: '一郎', termsVersion: TERMS_VERSION },
  })
  expect(useAuthStore().credential).toBe('session')
})

test('redeeming an invite keeps the member key as the credential', async () => {
  vi.mocked(apiClient.invites.redeem.$post).mockResolvedValue(
    Response.json({ memberKey: 'mk_secret' }) as never,
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
  vi.mocked(apiFetch).mockResolvedValue(Response.json({ sessionToken: 'dev', expiresAt: 1 }))
  const devLogin = inScope(useDevLoginMutation)

  await devLogin.mutateAsync({ googleSub: 'dev-owner-1', name: '一郎' })

  const [url, init] = vi.mocked(apiFetch).mock.calls[0]!
  expect(url).toBe('http://api.test/dev/login')
  expect(init?.body).toBe(JSON.stringify({ googleSub: 'dev-owner-1', name: '一郎' }))
  expect(useAuthStore().credential).toBe('dev')
})
