import { QueryClient } from '@tanstack/vue-query'
import { beforeEach, expect, test, vi } from 'vite-plus/test'
import { effectScope } from 'vue'

import { apiClient } from '../api/client.ts'
import { queryKeys } from './query-keys.ts'
import {
  useChildrenQuery,
  useCreateChildMutation,
  useDeleteChildMutation,
  useFetchSlotPrintCount,
  useRenameChildMutation,
} from './useChildren.ts'

vi.mock('../api/client.ts', () => ({
  apiClient: {
    children: { $get: vi.fn(), $post: vi.fn(), ':id': { $patch: vi.fn(), $delete: vi.fn() } },
    prints: { $get: vi.fn() },
  },
}))

const setup = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidated = vi.spyOn(queryClient, 'invalidateQueries')
  const inScope = <T>(create: (client: QueryClient) => T): T =>
    effectScope().run(() => create(queryClient))!
  const invalidatedKeys = () =>
    invalidated.mock.calls.map(
      ([filters]) => (filters as { queryKey?: unknown } | undefined)?.queryKey,
    )
  return { inScope, invalidatedKeys }
}

beforeEach(() => {
  vi.clearAllMocks()
})

test('lists the slots', async () => {
  const slots = [{ id: null, name: '家族共通', weekCount: 1, miteneCount: 0 }]
  vi.mocked(apiClient.children.$get).mockResolvedValue(Response.json(slots) as never)
  const { inScope } = setup()

  const query = inScope(useChildrenQuery)

  await vi.waitFor(() => expect(query.data.value).toEqual(slots))
})

test('adding a child refreshes the list, history and stats', async () => {
  vi.mocked(apiClient.children.$post).mockResolvedValue(
    Response.json({ id: 'c1', name: 'はなこ' }) as never,
  )
  const { inScope, invalidatedKeys } = setup()

  await inScope(useCreateChildMutation).mutateAsync('はなこ')

  expect(apiClient.children.$post).toHaveBeenCalledWith({ json: { name: 'はなこ' } })
  expect(invalidatedKeys()).toEqual([queryKeys.children, queryKeys.histories, queryKeys.stats])
})

test('renaming a child patches it by id', async () => {
  vi.mocked(apiClient.children[':id'].$patch).mockResolvedValue(
    Response.json({ id: 'c1', name: 'かなこ' }) as never,
  )
  const { inScope } = setup()

  await inScope(useRenameChildMutation).mutateAsync({ id: 'c1', name: 'かなこ' })

  expect(apiClient.children[':id'].$patch).toHaveBeenCalledWith({
    param: { id: 'c1' },
    json: { name: 'かなこ' },
  })
})

test('deleting a child also refreshes prints, since theirs are gone', async () => {
  vi.mocked(apiClient.children[':id'].$delete).mockResolvedValue(new Response(null) as never)
  const { inScope, invalidatedKeys } = setup()

  await inScope(useDeleteChildMutation).mutateAsync('c1')

  expect(apiClient.children[':id'].$delete).toHaveBeenCalledWith({ param: { id: 'c1' } })
  expect(invalidatedKeys()).toEqual([
    queryKeys.children,
    queryKeys.prints,
    queryKeys.histories,
    queryKeys.stats,
  ])
})

test("fetchSlotPrintCount counts all of a slot's prints", async () => {
  vi.mocked(apiClient.prints.$get).mockResolvedValue(Response.json([{}, {}, {}]) as never)
  const { inScope } = setup()

  const fetchCount = inScope(useFetchSlotPrintCount)

  await expect(fetchCount('c1')).resolves.toBe(3)
  expect(apiClient.prints.$get).toHaveBeenCalledWith({ query: { child: 'c1' } })
})
