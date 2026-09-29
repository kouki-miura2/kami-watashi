import { QueryClient } from '@tanstack/vue-query'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, expect, test, vi } from 'vite-plus/test'
import { effectScope } from 'vue'

import { apiClient } from '../api/client.ts'
import { ApiError } from '../api/errors.ts'
import { useAuthStore } from '../stores/auth.ts'
import { queryKeys } from './query-keys.ts'
import { loadSignIn, useLaunchQuery } from './useLaunchQuery.ts'

vi.mock('../api/client.ts', () => ({ apiClient: { launch: { $post: vi.fn() } } }))

const launchResponse = (isOwner: boolean) =>
  Response.json({
    me: { id: 'm1', name: '一郎', isOwner },
    termsVersion: '2026-10-01',
    termsAgreed: true,
  })

const run = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return effectScope().run(() => useLaunchQuery(queryClient))!
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

test('does not call /launch while signed out', () => {
  const query = run()

  expect(query.fetchStatus.value).toBe('idle')
  expect(apiClient.launch.$post).not.toHaveBeenCalled()
})

test('fetches who this browser is while signed in, keeping owner/member in step', async () => {
  vi.mocked(apiClient.launch.$post).mockResolvedValue(launchResponse(false) as never)
  const auth = useAuthStore()
  auth.signIn('owner')

  const query = run()

  await vi.waitFor(() => expect(query.isSuccess.value).toBe(true))
  expect(query.data.value?.me.name).toBe('一郎')
  expect(auth.isMember).toBe(true)
})

test('loadSignIn signs in as whoever the API answers, and seeds the launch query', async () => {
  vi.mocked(apiClient.launch.$post).mockResolvedValue(launchResponse(true) as never)
  const queryClient = new QueryClient()
  const auth = useAuthStore()

  await loadSignIn(queryClient, auth)

  expect(auth.isOwner).toBe(true)
  expect(queryClient.getQueryData(queryKeys.launch)).toMatchObject({ me: { isOwner: true } })
})

test('loadSignIn signs out quietly when the API rejects the credential cookie', async () => {
  vi.mocked(apiClient.launch.$post).mockRejectedValue(new ApiError('unauthorized', 401))
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const auth = useAuthStore()
  auth.signIn('owner')

  await loadSignIn(queryClient, auth)

  expect(auth.isSignedIn).toBe(false)
  // Signed out is an answer, not a failure for the app-wide error handler to report.
  expect(queryClient.getQueryCache().find({ queryKey: queryKeys.launch })?.meta).toEqual({
    handlesError: true,
  })
})

test('loadSignIn goes by the last sign-in when the API cannot be reached', async () => {
  vi.mocked(apiClient.launch.$post).mockRejectedValue(new ApiError('network_error', null))
  const auth = useAuthStore()
  vi.spyOn(auth, 'resumeLastSignIn')

  await loadSignIn(new QueryClient({ defaultOptions: { queries: { retry: false } } }), auth)

  expect(auth.resumeLastSignIn).toHaveBeenCalled()
})
