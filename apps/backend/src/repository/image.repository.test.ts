import { expect, test, vi } from 'vite-plus/test'

import type { ImageStorage } from '../dao/image-storage.interface.ts'
import { createImageRepository } from './image.repository.ts'

const createStorage = () => ({
  put: vi.fn<ImageStorage['put']>(async () => {}),
  get: vi.fn<ImageStorage['get']>(async () => null),
  delete: vi.fn<ImageStorage['delete']>(async () => {}),
  deleteByPrefix: vi.fn<ImageStorage['deleteByPrefix']>(async () => {}),
})

test('stores, reads and deletes images by their family/print/image key', async () => {
  const storage = createStorage()
  const repository = createImageRepository(storage)
  const data = new ArrayBuffer(3)

  await repository.putImages('f1', [
    { printId: 'p1', imageId: 'i1', data, contentType: 'image/webp' },
  ])
  await repository.getImage('f1', { printId: 'p1', imageId: 'i1' })
  await repository.deleteImages('f1', [
    { printId: 'p1', imageId: 'i1' },
    { printId: 'p1', imageId: 'i2' },
  ])

  expect(storage.put).toHaveBeenCalledWith('f1/p1/i1', data, 'image/webp')
  expect(storage.get).toHaveBeenCalledWith('f1/p1/i1')
  expect(storage.delete).toHaveBeenCalledWith(['f1/p1/i1', 'f1/p1/i2'])
})

test('does not call storage for nothing to delete', async () => {
  const storage = createStorage()

  await createImageRepository(storage).deleteImages('f1', [])

  expect(storage.delete).not.toHaveBeenCalled()
})

test('deletes all of a family’s images by its key prefix', async () => {
  const storage = createStorage()

  await createImageRepository(storage).deleteFamilyImages('f1')

  expect(storage.deleteByPrefix).toHaveBeenCalledWith('f1/')
})
