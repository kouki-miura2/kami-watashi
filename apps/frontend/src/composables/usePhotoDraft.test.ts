import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, expect, test, vi } from 'vite-plus/test'

import { rotatePhoto } from '../device/photos.ts'
import { usePhotoDraft } from './usePhotoDraft.ts'

vi.mock('vue', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue')>()),
  // No component here to unmount.
  onUnmounted: () => {},
}))
vi.mock('../device/photos.ts', () => ({
  rotatePhoto: vi.fn(
    async (photo: Blob, quarterTurns: number) =>
      new Blob([`${await photo.text()}+${quarterTurns}`]),
  ),
}))

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(rotatePhoto).mockClear()
})

test('each rotate turns the photo 90° more, always from the original, and the 4th undoes it', async () => {
  const draft = usePhotoDraft()
  const original = new Blob(['page'])
  await draft.add(async () => [original])

  await draft.rotate(0)
  expect(await draft.blobs()[0]!.text()).toBe('page+1')
  await draft.rotate(0)
  expect(await draft.blobs()[0]!.text()).toBe('page+2')
  await draft.rotate(0)
  expect(await draft.blobs()[0]!.text()).toBe('page+3')
  expect(vi.mocked(rotatePhoto).mock.calls.map(([photo]) => photo)).toEqual([
    original,
    original,
    original,
  ])

  await draft.rotate(0)
  expect(draft.blobs()[0]).toBe(original)
  expect(draft.photos.value[0]!.quarterTurns).toBe(0)
})

test('a tap while still rotating is ignored', async () => {
  const draft = usePhotoDraft()
  await draft.add(async () => [new Blob(['page'])])

  const first = draft.rotate(0)
  await draft.rotate(0)
  await first

  expect(rotatePhoto).toHaveBeenCalledOnce()
  expect(draft.photos.value[0]!.quarterTurns).toBe(1)
})
