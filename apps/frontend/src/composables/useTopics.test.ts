import { QueryClient } from '@tanstack/vue-query'
import { beforeEach, expect, test, vi } from 'vite-plus/test'
import { effectScope } from 'vue'

import { apiClient } from '../api/client.ts'
import { queryKeys } from './query-keys.ts'
import {
  useCreateTopicMutation,
  useDeleteTopicMutation,
  useRenameTopicMutation,
  useTopicsQuery,
} from './useTopics.ts'

vi.mock('../api/client.ts', () => ({
  apiClient: {
    topics: { $get: vi.fn(), $post: vi.fn(), ':id': { $patch: vi.fn(), $delete: vi.fn() } },
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

test('lists the topics with their print counts', async () => {
  const topics = [{ id: 't1', name: 'サッカー', printCount: 2 }]
  vi.mocked(apiClient.topics.$get).mockResolvedValue(Response.json(topics) as never)
  const { inScope } = setup()

  const query = inScope(useTopicsQuery)

  await vi.waitFor(() => expect(query.data.value).toEqual(topics))
})

test('adding a topic refreshes the topics and history', async () => {
  vi.mocked(apiClient.topics.$post).mockResolvedValue(
    Response.json({ id: 't1', name: 'サッカー' }) as never,
  )
  const { inScope, invalidatedKeys } = setup()

  await inScope(useCreateTopicMutation).mutateAsync('サッカー')

  expect(invalidatedKeys()).toEqual([queryKeys.topics, queryKeys.histories])
})

test('renaming and deleting a topic also refresh prints, which show topic names', async () => {
  vi.mocked(apiClient.topics[':id'].$patch).mockResolvedValue(
    Response.json({ id: 't1', name: 'サッカークラブ' }) as never,
  )
  vi.mocked(apiClient.topics[':id'].$delete).mockResolvedValue(new Response(null) as never)
  const { inScope, invalidatedKeys } = setup()

  await inScope(useRenameTopicMutation).mutateAsync({ id: 't1', name: 'サッカークラブ' })
  await inScope(useDeleteTopicMutation).mutateAsync('t1')

  expect(apiClient.topics[':id'].$delete).toHaveBeenCalledWith({ param: { id: 't1' } })
  expect(invalidatedKeys()).toEqual([
    queryKeys.topics,
    queryKeys.prints,
    queryKeys.histories,
    queryKeys.topics,
    queryKeys.prints,
    queryKeys.histories,
  ])
})
