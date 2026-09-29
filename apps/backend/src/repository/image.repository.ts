import type { ImageContentType, ImageStorage, StoredImage } from '../dao/image-storage.interface.ts'

export interface ImageRef {
  printId: string
  imageId: string
}

export interface ImageRepository {
  putImages: (
    familyId: string,
    images: (ImageRef & { data: ArrayBuffer; contentType: ImageContentType })[],
  ) => Promise<void>
  getImage: (familyId: string, image: ImageRef) => Promise<StoredImage | null>
  deleteImages: (familyId: string, images: ImageRef[]) => Promise<void>
  /** Every photo of the family, by the `{family_id}/` key prefix. */
  deleteFamilyImages: (familyId: string) => Promise<void>
}

/** R2 object key (spec "R2（画像）"): the family prefix lets a whole family be deleted at once. */
export const imageKey = (familyId: string, { printId, imageId }: ImageRef): string =>
  `${familyId}/${printId}/${imageId}`

export const createImageRepository = (storage: ImageStorage): ImageRepository => ({
  putImages: async (familyId, images) => {
    await Promise.all(
      images.map((image) => storage.put(imageKey(familyId, image), image.data, image.contentType)),
    )
  },
  getImage: async (familyId, image) => storage.get(imageKey(familyId, image)),
  deleteImages: async (familyId, images) => {
    if (images.length === 0) return
    await storage.delete(images.map((image) => imageKey(familyId, image)))
  },
  deleteFamilyImages: async (familyId) => storage.deleteByPrefix(`${familyId}/`),
})
