import { QueryClient } from '@tanstack/vue-query'
import { beforeEach, expect, test, vi } from 'vite-plus/test'
import { effectScope } from 'vue'

import { apiClient } from '../api/client.ts'
import { queryKeys } from './query-keys.ts'
import {
  type NewPrint,
  useCreatePrintMutation,
  useDeletePrintMutation,
  usePrintQuery,
  usePrintsQuery,
  useUpdatePrintMutation,
} from './usePrints.ts'

vi.mock('../api/client.ts', () => ({
  apiClient: {
    prints: {
      $get: vi.fn(),
      $post: vi.fn(),
      ':id': { $get: vi.fn(), $patch: vi.fn(), $delete: vi.fn() },
    },
  },
}))

const print: NewPrint = {
  slot: 'common',
  title: '運動会のお知らせ',
  receivedOn: '2026-09-28',
  dueOn: null,
  topicIds: ['t1', 't2'],
  responseStatus: 'todo',
  photos: [new Blob(['page 1']), new Blob(['page 2'])],
}

const setup = () => {
  const queryClient = new QueryClient()
  const invalidated = vi.spyOn(queryClient, 'invalidateQueries')
  const mutation = effectScope().run(() => useCreatePrintMutation(queryClient))!
  const invalidatedKeys = () =>
    invalidated.mock.calls.map(
      ([filters]) => (filters as { queryKey?: unknown } | undefined)?.queryKey,
    )
  return { queryClient, mutation, invalidatedKeys }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(apiClient.prints.$post).mockResolvedValue(
    Response.json({ id: 'p1', childId: null, seq: 1 }, { status: 201 }) as never,
  )
})

test('posts the form with the photos as JPEG pages, in order', async () => {
  const { mutation } = setup()

  await mutation.mutateAsync(print)

  const [args, options] = vi.mocked(apiClient.prints.$post).mock.calls[0]!
  const { images, ...fields } = args.form
  expect(fields).toEqual({
    childId: 'common',
    title: '運動会のお知らせ',
    receivedOn: '2026-09-28',
    // A cleared date is sent empty, not as "null".
    dueOn: '',
    topicIds: ['t1', 't2'],
    responseStatus: 'todo',
  })
  const files = images as File[]
  expect(files.map((file) => [file.name, file.type])).toEqual([
    ['page-1.jpg', 'image/jpeg'],
    ['page-2.jpg', 'image/jpeg'],
  ])
  expect(await files[1]!.text()).toBe('page 2')
  // Uploads get their own, longer timeout.
  expect(options?.init?.signal).toBeInstanceOf(AbortSignal)
})

test('refreshes everything a new print shows up in', async () => {
  const { mutation, invalidatedKeys } = setup()

  await mutation.mutateAsync(print)

  expect(invalidatedKeys()).toEqual([
    queryKeys.children,
    queryKeys.prints,
    queryKeys.topics,
    queryKeys.histories,
    queryKeys.stats,
  ])
})

test('leaves failures (storage_limit) to the registration screen', async () => {
  const { queryClient, mutation } = setup()

  await mutation.mutateAsync(print)

  expect(queryClient.getMutationCache().getAll()[0]?.meta).toEqual({ handlesError: true })
})

test('lists a slot with the filter as API query parameters', async () => {
  vi.mocked(apiClient.prints.$get).mockResolvedValue(Response.json([]) as never)
  const queryClient = new QueryClient()

  const query = effectScope().run(() =>
    usePrintsQuery('c1', { sort: 'due', topicIds: ['t1'], mitene: 'requested' }, queryClient),
  )!

  await vi.waitFor(() => expect(query.isSuccess.value).toBe(true))
  expect(apiClient.prints.$get).toHaveBeenCalledWith({
    query: { child: 'c1', sort: 'due', topicIds: 't1', mitene: 'requested' },
  })
})

test('opening a print refreshes the lists and home badges, but not itself', async () => {
  vi.mocked(apiClient.prints[':id'].$get).mockResolvedValue(Response.json({ id: 'p1' }) as never)
  const queryClient = new QueryClient()
  const invalidated = vi.spyOn(queryClient, 'invalidateQueries')

  const query = effectScope().run(() => usePrintQuery('p1', queryClient))!

  await vi.waitFor(() => expect(query.isSuccess.value).toBe(true))
  expect(invalidated).toHaveBeenCalledWith({ queryKey: queryKeys.children })
  const [{ predicate }] = invalidated.mock.calls.find(([filters]) =>
    Boolean((filters as { predicate?: unknown }).predicate),
  ) as [{ predicate: (query: { queryKey: readonly unknown[] }) => boolean }]
  expect(predicate({ queryKey: ['prints', 'c1', {}] })).toBe(true)
  expect(predicate({ queryKey: ['prints', 'detail', 'p1'] })).toBe(false)
})

test('an update maps the common slot to null and empty dates to cleared', async () => {
  vi.mocked(apiClient.prints[':id'].$patch).mockResolvedValue(
    Response.json({ id: 'p1', childId: null, seq: 7 }) as never,
  )
  const mutation = effectScope().run(() => useUpdatePrintMutation(new QueryClient()))!

  const moved = await mutation.mutateAsync({
    id: 'p1',
    changes: {
      slot: 'common',
      title: '',
      receivedOn: '',
      dueOn: '2026-10-03',
      responseStatus: 'done',
    },
  })

  expect(apiClient.prints[':id'].$patch).toHaveBeenCalledWith({
    param: { id: 'p1' },
    json: {
      childId: null,
      title: '',
      receivedOn: null,
      dueOn: '2026-10-03',
      responseStatus: 'done',
    },
  })
  expect(moved).toEqual({ id: 'p1', childId: null, seq: 7 })
})

test('an update leaves out what did not change', async () => {
  vi.mocked(apiClient.prints[':id'].$patch).mockResolvedValue(
    Response.json({ id: 'p1', childId: 'c1', seq: 3 }) as never,
  )
  const mutation = effectScope().run(() => useUpdatePrintMutation(new QueryClient()))!

  await mutation.mutateAsync({ id: 'p1', changes: { responseStatus: 'todo' } })

  expect(apiClient.prints[':id'].$patch).toHaveBeenCalledWith({
    param: { id: 'p1' },
    json: { responseStatus: 'todo' },
  })
})

test('deleting drops that print from the cache instead of refetching it', async () => {
  vi.mocked(apiClient.prints[':id'].$delete).mockResolvedValue(new Response(null) as never)
  const queryClient = new QueryClient()
  queryClient.setQueryData(['prints', 'detail', 'p1'], { id: 'p1' })
  queryClient.setQueryData(['prints', 'detail', 'p2'], { id: 'p2' })
  const mutation = effectScope().run(() => useDeletePrintMutation(queryClient))!

  await mutation.mutateAsync('p1')

  expect(queryClient.getQueryData(['prints', 'detail', 'p1'])).toBeUndefined()
  expect(queryClient.getQueryData(['prints', 'detail', 'p2'])).toEqual({ id: 'p2' })
})
