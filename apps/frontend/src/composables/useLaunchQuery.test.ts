import { QueryClient } from '@tanstack/vue-query'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, expect, test, vi } from 'vite-plus/test'
import { effectScope } from 'vue'

import { apiClient } from '../api/client.ts'
import { useAuthStore } from '../stores/auth.ts'
import { useLaunchQuery } from './useLaunchQuery.ts'

vi.mock('../api/client.ts', () => ({ apiClient: { launch: { $post: vi.fn() } } }))
vi.mock('../api/credential-storage.ts', () => ({
  credentialStorage: { load: vi.fn(), save: vi.fn(), clear: vi.fn() },
}))

const launchResponse = (session: { sessionToken: string; expiresAt: number } | null) =>
  Response.json({
    me: { id: 'm1', name: '一郎', isOwner: session !== null },
    termsVersion: '2026-10-01',
    termsAgreed: true,
    session,
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

test("replaces the owner's session token with the renewed one", async () => {
  vi.mocked(apiClient.launch.$post).mockResolvedValue(
    launchResponse({ sessionToken: 'renewed', expiresAt: 1 }) as never,
  )
  const auth = useAuthStore()
  await auth.signIn('old')

  const query = run()

  await vi.waitFor(() => expect(query.isSuccess.value).toBe(true))
  expect(auth.credential).toBe('renewed')
  expect(query.data.value?.me.name).toBe('一郎')
})

test("keeps an invited member's key (no session in the response)", async () => {
  vi.mocked(apiClient.launch.$post).mockResolvedValue(launchResponse(null) as never)
  const auth = useAuthStore()
  await auth.signIn('mk_secret')

  const query = run()

  await vi.waitFor(() => expect(query.isSuccess.value).toBe(true))
  expect(auth.credential).toBe('mk_secret')
})
