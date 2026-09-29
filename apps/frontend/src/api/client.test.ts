import { afterEach, expect, test, vi } from 'vite-plus/test'

import { apiClient } from './client.ts'
import { ApiError } from './errors.ts'

afterEach(() => {
  vi.restoreAllMocks()
})

const lastRequestInit = (fetchSpy: { mock: { calls: unknown[][] } }): RequestInit =>
  fetchSpy.mock.calls.at(-1)?.[1] as RequestInit

test('exposes a typed RPC method for each backend route', () => {
  expect(apiClient.members.$get).toBeTypeOf('function')
})

test('sends requests with an abort signal so they time out', async () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('[]'))

  await apiClient.members.$get()

  expect(fetchSpy).toHaveBeenCalledTimes(1)
  expect(lastRequestInit(fetchSpy).signal).toBeInstanceOf(AbortSignal)
})

test("keeps the caller's own signal instead of the default timeout", async () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('[]'))
  const signal = new AbortController().signal

  await apiClient.members.$get(undefined, { init: { signal } })

  expect(lastRequestInit(fetchSpy).signal).toBe(signal)
})

test('sends the credential cookie, and no authorization header', async () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('[]'))

  await apiClient.members.$get()

  expect(lastRequestInit(fetchSpy).credentials).toBe('include')
  expect(new Headers(lastRequestInit(fetchSpy).headers).has('authorization')).toBe(false)
})

test('throws an ApiError with the response error code for a non-2xx response', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    Response.json({ error: 'name_taken' }, { status: 409 }),
  )

  const request = apiClient.topics.$post({ json: { name: 'サッカー' } })

  await expect(request).rejects.toEqual(new ApiError('name_taken', 409))
})

test('turns a timeout into an ApiError', async () => {
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(
    new DOMException('The operation timed out.', 'TimeoutError'),
  )

  await expect(apiClient.members.$get()).rejects.toMatchObject({ code: 'timeout', status: null })
})

test('turns a network failure into an ApiError', async () => {
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))

  await expect(apiClient.members.$get()).rejects.toMatchObject({
    code: 'network_error',
    status: null,
  })
})
