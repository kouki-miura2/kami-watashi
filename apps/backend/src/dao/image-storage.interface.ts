export interface StoredImage {
  body: ReadableStream
  size: number
}

/** Object storage for print photos (R2 in the Worker). Keys are `{family_id}/{print_id}/{print_image_id}`. */
export interface ImageStorage {
  /** Stores a JPEG. Keys are never reused, so this never overwrites a served object. */
  put: (key: string, data: ArrayBuffer) => Promise<void>
  get: (key: string) => Promise<StoredImage | null>
  /** Deletes the objects; missing keys are ignored. */
  delete: (keys: string[]) => Promise<void>
  /** Deletes every object whose key starts with `prefix`. */
  deleteByPrefix: (prefix: string) => Promise<void>
}
