import { createPinia, setActivePinia } from 'pinia'
import { LIMITS } from 'utils'
import { beforeEach, expect, test, vi } from 'vite-plus/test'

import { apiClient } from '../api/client.ts'
import { rotatePhoto } from '../device/photos.ts'
import { useConfirmStore } from '../stores/confirm.ts'
import { usePrintPhotoDraft } from './usePrintPhotoDraft.ts'

vi.mock('vue', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue')>()),
  onUnmounted: () => {},
}))
vi.mock('../api/client.ts', () => ({ apiClient: { images: { ':id': { $get: vi.fn() } } } }))
vi.mock('../device/photos.ts', () => ({
  rotatePhoto: vi.fn(
    async (photo: Blob, turns: number) => new Blob([`${await photo.text()}+${turns}`]),
  ),
}))

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  vi.mocked(apiClient.images[':id'].$get).mockImplementation(
    async ({ param }) =>
      new Response(param.id, { headers: { 'content-type': 'image/jpeg' } }) as never,
  )
})

const loadDraft = async () => {
  const draft = usePrintPhotoDraft()
  await draft.load(['page-1', 'page-2', 'page-3'])
  return draft
}
const contents = (photos: Blob[]) => Promise.all(photos.map((photo) => photo.text()))

test('loads saved pages in order without re-encoding or marking photos changed', async () => {
  const draft = await loadDraft()
  expect(await contents(draft.blobs())).toEqual(['page-1', 'page-2', 'page-3'])
  expect(draft.blobs().map((photo) => photo.type)).toEqual(Array(3).fill('image/jpeg'))
  expect(draft.changed.value).toBe(false)
  expect(draft.ready.value).toBe(true)
  expect(draft.photosLeft.value).toBe(LIMITS.printImages - 3)
  expect(rotatePhoto).not.toHaveBeenCalled()
  await draft.load(['page-4'])
  expect(apiClient.images[':id'].$get).toHaveBeenCalledTimes(3)
  draft.clear()
})

test('rotates only the chosen saved page and the fourth turn restores its original bytes', async () => {
  const draft = await loadDraft()
  const originals = draft.blobs()
  await draft.rotate(1)
  expect(await contents(draft.blobs())).toEqual(['page-1', 'page-2+1', 'page-3'])
  expect(draft.blobs()[0]).toBe(originals[0])
  expect(draft.blobs()[2]).toBe(originals[2])
  expect(draft.changed.value).toBe(true)
  await draft.rotate(1)
  await draft.rotate(1)
  await draft.rotate(1)
  expect(draft.blobs()).toEqual(originals)
  expect(draft.changed.value).toBe(false)
  draft.clear()
})

test('cancelling deletion preserves the chosen photo and its thumbnail URL', async () => {
  const draft = await loadDraft()
  const original = draft.photos.value[1]!
  const removing = draft.remove(1)
  const confirm = useConfirmStore()
  expect(confirm.options?.title).toBe('2ページ目の写真を削除しますか？')
  expect(draft.photos.value).toContain(original)
  confirm.answer(false)
  await removing
  expect(draft.photos.value[1]).toBe(original)
  expect(draft.changed.value).toBe(false)
  draft.clear()
})

test('confirmed deletion removes exactly the selected page and frees its thumbnail URL', async () => {
  const draft = await loadDraft()
  const removedUrl = draft.photos.value[1]!.url
  const revoke = vi.spyOn(URL, 'revokeObjectURL')
  const removing = draft.remove(1)
  expect(draft.photos.value).toHaveLength(3)
  useConfirmStore().answer(true)
  await removing
  expect(await contents(draft.blobs())).toEqual(['page-1', 'page-3'])
  expect(revoke).toHaveBeenCalledWith(removedUrl)
  expect(draft.changed.value).toBe(true)
  expect(draft.photosLeft.value).toBe(LIMITS.printImages - 2)
  revoke.mockRestore()
  draft.clear()
})

test('added photos follow the remaining saved pages and also require deletion confirmation', async () => {
  const draft = await loadDraft()
  await draft.add(async () => [new Blob(['added'])])
  expect(await contents(draft.blobs())).toEqual(['page-1', 'page-2', 'page-3', 'added'])
  const removing = draft.remove(3)
  useConfirmStore().answer(false)
  await removing
  expect(draft.blobs()).toHaveLength(4)
  expect(draft.changed.value).toBe(true)
  draft.clear()
})

test('cancelling a full retake keeps saved pages, rotations, and added pages intact', async () => {
  const draft = await loadDraft()
  await draft.rotate(0)
  await draft.add(async () => [new Blob(['added'])])
  const before = draft.blobs()
  const retaking = draft.startRetake()
  expect(useConfirmStore().options?.confirmText).toBe('撮り直す')
  expect(draft.blobs()).toEqual(before)
  useConfirmStore().answer(false)
  expect(await retaking).toBe(false)
  expect(draft.retaking.value).toBe(false)
  expect(draft.blobs()).toEqual(before)
  draft.clear()
})

test('a confirmed retake clears the draft; stopping it restores all original saved photos', async () => {
  const draft = await loadDraft()
  const originals = draft.blobs()
  const retaking = draft.startRetake()
  useConfirmStore().answer(true)
  expect(await retaking).toBe(true)
  expect(draft.retaking.value).toBe(true)
  expect(draft.blobs()).toEqual([])
  expect(draft.changed.value).toBe(true)
  await draft.add(async () => [new Blob(['replacement'])])
  await draft.cancelRetake()
  expect(draft.retaking.value).toBe(false)
  expect(draft.blobs()).toEqual(originals)
  expect(draft.changed.value).toBe(false)
  draft.clear()
})

test('an incomplete download blocks editing and can be retried without losing saved pages', async () => {
  const draft = usePrintPhotoDraft()
  vi.mocked(apiClient.images[':id'].$get).mockRejectedValueOnce(new Error('network'))
  await draft.load(['page-1', 'page-2'])
  expect(draft.ready.value).toBe(false)
  expect(draft.busy.value).toBe(true)
  expect(draft.blobs()).toEqual([])
  expect(await draft.startRetake()).toBe(false)
  expect(useConfirmStore().options).toBeNull()
  await draft.load(['page-1', 'page-2'])
  expect(draft.ready.value).toBe(true)
  expect(await contents(draft.blobs())).toEqual(['page-1', 'page-2'])
  expect(draft.changed.value).toBe(false)
  draft.clear()
})
