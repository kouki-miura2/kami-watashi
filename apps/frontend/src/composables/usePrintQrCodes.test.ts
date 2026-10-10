import { QueryClient } from '@tanstack/vue-query'
import { LIMITS } from 'utils'
import { beforeEach, expect, test, vi } from 'vite-plus/test'
import { effectScope } from 'vue'

import { apiClient } from '../api/client.ts'
import { readPhotoQrCodes } from '../device/qr-codes.ts'
import { usePrintQrCodes } from './usePrintQrCodes.ts'

vi.mock('../api/client.ts', () => ({ apiClient: { images: { ':id': { $get: vi.fn() } } } }))
vi.mock('../device/qr-codes.ts', () => ({ readPhotoQrCodes: vi.fn() }))

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(apiClient.images[':id'].$get).mockImplementation(
    async ({ param }) => new Response(new Blob([param.id])) as never,
  )
})

const scan = async (imageId: string, page: number) => {
  const scope = effectScope()
  const reader = scope.run(() =>
    usePrintQrCodes(new QueryClient({ defaultOptions: { mutations: { retry: false } } })),
  )!
  try {
    return await reader.mutateAsync({ imageId, page })
  } finally {
    scope.stop()
  }
}

test('no QR codes on the displayed photo returns an empty result', async () => {
  vi.mocked(readPhotoQrCodes).mockResolvedValueOnce([])
  expect(await scan('page-2', 2)).toEqual([])
})

test('only downloads the displayed photo and preserves its actual page number', async () => {
  vi.mocked(readPhotoQrCodes).mockResolvedValueOnce(['https://qr.test/'])
  expect(await scan('page-3', 3)).toEqual([{ text: 'https://qr.test/', page: 3 }])
  expect(apiClient.images[':id'].$get).toHaveBeenCalledExactlyOnceWith({ param: { id: 'page-3' } })
  expect(readPhotoQrCodes).toHaveBeenCalledTimes(1)
  expect(await vi.mocked(readPhotoQrCodes).mock.calls[0]![0].text()).toBe('page-3')
  expect(vi.mocked(readPhotoQrCodes).mock.calls[0]![1]).toBe(LIMITS.printQrCodes)
})

test('multiple codes on one photo keep repeated URLs as separate choices', async () => {
  vi.mocked(readPhotoQrCodes).mockResolvedValueOnce(['same', 'second', 'same'])
  expect(await scan('page-2', 2)).toEqual([
    { text: 'same', page: 2 },
    { text: 'second', page: 2 },
    { text: 'same', page: 2 },
  ])
})

test.each([LIMITS.printQrCodes, LIMITS.printQrCodes + 1])(
  'retains %i detections for the displayed photo limit check',
  async (count) => {
    vi.mocked(readPhotoQrCodes).mockResolvedValueOnce(Array.from({ length: count }, () => 'code'))
    expect(await scan('page-2', 2)).toHaveLength(count)
    expect(apiClient.images[':id'].$get).toHaveBeenCalledTimes(1)
  },
)

test('a download failure is an error rather than a not-found result', async () => {
  vi.mocked(apiClient.images[':id'].$get).mockRejectedValueOnce(new Error('download failed'))
  await expect(scan('page-2', 2)).rejects.toThrow('download failed')
  expect(readPhotoQrCodes).not.toHaveBeenCalled()
})
