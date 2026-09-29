import { LIMITS } from 'utils'

import { fitLongEdge } from '../lib/photos.ts'

/**
 * Re-encodes a photo the way the spec stores it: downscaled to `LIMITS.imageLongEdgePx` on the long
 * edge (only if larger), JPEG at `LIMITS.imageJpegQuality`. Drawing it onto a canvas drops the EXIF
 * data (location and all), and `createImageBitmap` applies the EXIF orientation first.
 */
export const optimizePhoto = async (source: Blob): Promise<Blob> => {
  const bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' })
  const { width, height } = fitLongEdge(bitmap.width, bitmap.height, LIMITS.imageLongEdgePx)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the photo'))),
      'image/jpeg',
      LIMITS.imageJpegQuality,
    ),
  )
}

/**
 * The browser's file picker for images (`[]` if the user backs out). `capture` opens the camera
 * instead, on phones. Call it right from a tap: browsers open pickers only on a user gesture.
 */
const pickImages = (options: { capture?: boolean; multiple?: boolean }): Promise<File[]> =>
  new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.multiple = options.multiple ?? false
    if (options.capture) input.setAttribute('capture', 'environment')
    // Kept in the document until it answers: some mobile browsers drop a detached input's events.
    input.hidden = true
    const done = (files: File[]) => {
      input.remove()
      resolve(files)
    }
    input.addEventListener('change', () => done([...(input.files ?? [])]))
    input.addEventListener('cancel', () => done([]))
    document.body.append(input)
    input.click()
  })

/** One photo from the camera, optimized (`[]` if cancelled). */
export const takePhoto = async (): Promise<Blob[]> => {
  const [photo] = await pickImages({ capture: true })
  return photo ? [await optimizePhoto(photo)] : []
}

/** Up to `limit` saved photos, in the order the browser lists them, optimized (`[]` if cancelled). */
export const choosePhotos = async (limit: number): Promise<Blob[]> => {
  // The picker can't cap how many are chosen, so the rest are left out here.
  const photos = (await pickImages({ multiple: limit > 1 })).slice(0, limit)
  return Promise.all(photos.map(optimizePhoto))
}
