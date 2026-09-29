/** The photo formats stored: WebP, and JPEG from before the switch to it. */
export type ImageContentType = 'image/webp' | 'image/jpeg'

export interface StoredImage {
  body: ReadableStream
  size: number
  contentType: ImageContentType
}

/** Object storage for print photos (R2 in the Worker). Keys are `{family_id}/{print_id}/{print_image_id}`. */
export interface ImageStorage {
  /** Stores a photo. Keys are never reused, so this never overwrites a served object. */
  put: (key: string, data: ArrayBuffer, contentType: ImageContentType) => Promise<void>
  get: (key: string) => Promise<StoredImage | null>
  /** Deletes the objects; missing keys are ignored. */
  delete: (keys: string[]) => Promise<void>
  /** Deletes every object whose key starts with `prefix`. */
  deleteByPrefix: (prefix: string) => Promise<void>
}
