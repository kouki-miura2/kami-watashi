import { afterAll, beforeAll, expect, test } from 'vite-plus/test'

import { createTestD1 } from './d1.testing.ts'
import { createR2ImageStorage } from './image-storage.r2.ts'

let testEnv: Awaited<ReturnType<typeof createTestD1>>

beforeAll(async () => {
  testEnv = await createTestD1()
})

afterAll(async () => {
  await testEnv.dispose()
})

test('delete removes the given objects only, ignoring missing keys', async () => {
  const { images } = testEnv
  await Promise.all(['f1/p1/i1', 'f1/p1/i2', 'f1/p2/i3'].map((key) => images.put(key, 'jpeg')))

  await createR2ImageStorage(images).delete(['f1/p1/i1', 'f1/p1/i2', 'f1/p9/missing'])

  expect((await images.list({ prefix: 'f1/' })).objects.map((object) => object.key)).toEqual([
    'f1/p2/i3',
  ])
})

test('put stores a JPEG that get returns with its size; get of a missing key is null', async () => {
  const storage = createR2ImageStorage(testEnv.images)
  const data = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2]).buffer

  await storage.put('f2/p1/i1', data)
  const stored = await storage.get('f2/p1/i1')

  expect(stored?.size).toBe(6)
  expect(new Uint8Array(await new Response(stored?.body).arrayBuffer())).toEqual(
    new Uint8Array(data),
  )
  expect((await testEnv.images.head('f2/p1/i1'))?.httpMetadata?.contentType).toBe('image/jpeg')
  expect(await storage.get('f2/p1/missing')).toBeNull()
})

test('deleteByPrefix removes every object under the prefix only', async () => {
  const { images } = testEnv
  await Promise.all(
    ['fam-a/p1/i1', 'fam-a/p1/i2', 'fam-a/p2/i3', 'fam-b/p1/i1', 'fam-ab/p1/i1'].map((key) =>
      images.put(key, 'x'),
    ),
  )

  await createR2ImageStorage(images).deleteByPrefix('fam-a/')

  expect((await images.list({ prefix: 'fam-' })).objects.map((object) => object.key)).toEqual([
    'fam-ab/p1/i1',
    'fam-b/p1/i1',
  ])
})

test('deleteByPrefix follows the list cursor across pages', async () => {
  // Real R2 pages hold 1000 keys; a fake with 2-key pages exercises the loop cheaply.
  const keys = ['f/1', 'f/2', 'f/3', 'f/4', 'f/5']
  const deleted: string[][] = []
  const bucket = {
    list: async ({ cursor }: { prefix: string; cursor?: string }) => {
      const start = Number(cursor ?? 0)
      const page = keys.slice(start, start + 2)
      const truncated = start + 2 < keys.length
      return {
        objects: page.map((key) => ({ key })),
        truncated,
        cursor: truncated ? String(start + 2) : undefined,
      }
    },
    delete: async (batch: string[]) => {
      deleted.push(batch)
    },
  } as unknown as R2Bucket

  await createR2ImageStorage(bucket).deleteByPrefix('f/')

  expect(deleted).toEqual([['f/1', 'f/2'], ['f/3', 'f/4'], ['f/5']])
})
