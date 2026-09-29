import type { ImageContentType, ImageStorage } from 'backend/src/dao/image-storage.interface.ts'

// R2 accepts at most 1000 keys per delete call.
const MAX_KEYS_PER_DELETE = 1000

export const createR2ImageStorage = (bucket: R2Bucket): ImageStorage => ({
  put: async (key, data, contentType) => {
    await bucket.put(key, data, { httpMetadata: { contentType } })
  },

  get: async (key) => {
    const object = await bucket.get(key)
    if (!object) return null
    const contentType = (object.httpMetadata?.contentType ?? 'image/jpeg') as ImageContentType
    return { body: object.body, size: object.size, contentType }
  },

  delete: async (keys) => {
    for (let start = 0; start < keys.length; start += MAX_KEYS_PER_DELETE) {
      await bucket.delete(keys.slice(start, start + MAX_KEYS_PER_DELETE))
    }
  },

  deleteByPrefix: async (prefix) => {
    // A list page holds at most 1000 keys, matching the delete limit. Deleting doesn't disturb
    // the cursor: it only points past what was already listed.
    let cursor: string | undefined
    do {
      const page = await bucket.list({ prefix, cursor })
      if (page.objects.length > 0) await bucket.delete(page.objects.map((object) => object.key))
      cursor = page.truncated ? page.cursor : undefined
    } while (cursor)
  },
})
