import { QueryClient } from '@tanstack/vue-query'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, expect, test, vi } from 'vite-plus/test'
import { effectScope } from 'vue'

import { apiClient } from '../api/client.ts'
import { useAuthStore } from '../stores/auth.ts'
import { queryKeys } from './query-keys.ts'
import {
  useLeaveFamilyMutation,
  useRemoveMemberMutation,
  useRenameMeMutation,
} from './useMembers.ts'

const router = vi.hoisted(() => ({ replace: vi.fn(async () => undefined) }))
vi.mock('vue-router', () => ({ useRouter: () => router }))
vi.mock('../api/client.ts', () => ({
  apiClient: {
    me: { $patch: vi.fn(), $delete: vi.fn() },
    members: { ':id': { $delete: vi.fn() } },
    family: { $delete: vi.fn() },
  },
}))
vi.mock('../api/credential-storage.ts', () => ({
  credentialStorage: { load: vi.fn(), save: vi.fn(), clear: vi.fn() },
}))

const setup = () => {
  const queryClient = new QueryClient()
  const invalidated = vi.spyOn(queryClient, 'invalidateQueries')
  const inScope = <T>(create: (client: QueryClient) => T): T =>
    effectScope().run(() => create(queryClient))!
  const invalidatedKeys = () =>
    invalidated.mock.calls.map(
      ([filters]) => (filters as { queryKey?: unknown } | undefined)?.queryKey,
    )
  return { queryClient, inScope, invalidatedKeys }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  vi.mocked(apiClient.me.$delete).mockResolvedValue(new Response(null) as never)
  vi.mocked(apiClient.family.$delete).mockResolvedValue(new Response(null) as never)
})

test('renaming yourself refreshes the members, me, and history', async () => {
  vi.mocked(apiClient.me.$patch).mockResolvedValue(
    Response.json({ id: 'm1', name: '一朗' }) as never,
  )
  const { inScope, invalidatedKeys } = setup()

  await inScope(useRenameMeMutation).mutateAsync('一朗')

  expect(apiClient.me.$patch).toHaveBeenCalledWith({ json: { name: '一朗' } })
  expect(invalidatedKeys()).toEqual([queryKeys.members, queryKeys.launch, queryKeys.histories])
})

test('removing a member deletes them by id', async () => {
  vi.mocked(apiClient.members[':id'].$delete).mockResolvedValue(new Response(null) as never)
  const { inScope } = setup()

  await inScope(useRemoveMemberMutation).mutateAsync('m2')

  expect(apiClient.members[':id'].$delete).toHaveBeenCalledWith({ param: { id: 'm2' } })
})

test('an invited member leaves: signs out, back to welcome, cache cleared', async () => {
  const { queryClient, inScope } = setup()
  queryClient.setQueryData(queryKeys.children, [])
  await useAuthStore().signIn('mk_secret')

  await inScope(useLeaveFamilyMutation).mutateAsync()

  expect(apiClient.me.$delete).toHaveBeenCalled()
  expect(apiClient.family.$delete).not.toHaveBeenCalled()
  expect(useAuthStore().isSignedIn).toBe(false)
  expect(router.replace).toHaveBeenCalledWith({ name: 'welcome' })
  expect(queryClient.getQueryData(queryKeys.children)).toBeUndefined()
})

test('the owner withdraws, deleting the family', async () => {
  const { inScope } = setup()
  await useAuthStore().signIn('owner-session')

  await inScope(useLeaveFamilyMutation).mutateAsync()

  expect(apiClient.family.$delete).toHaveBeenCalled()
  expect(apiClient.me.$delete).not.toHaveBeenCalled()
  expect(useAuthStore().isSignedIn).toBe(false)
})
