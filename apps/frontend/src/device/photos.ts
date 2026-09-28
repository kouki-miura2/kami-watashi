import { Camera } from '@capacitor/camera'
import { LIMITS } from 'utils'

import { isCancellation } from '../lib/cancellation.ts'
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

const load = async (webPath: string | undefined): Promise<Blob> => {
  if (!webPath) throw new Error('The photo has no path')
  return (await fetch(webPath)).blob()
}

/** Resolves `[]` when the user backs out of the camera or gallery. */
const unlessCancelled = async (pick: () => Promise<Blob[]>): Promise<Blob[]> => {
  try {
    return await pick()
  } catch (error) {
    if (isCancellation(error)) return []
    throw error
  }
}

/** One photo from the device camera, optimized (`[]` if cancelled). */
export const takePhoto = () =>
  unlessCancelled(async () => {
    // Full quality from the camera: `optimizePhoto` does the one lossy re-encode.
    const photo = await Camera.takePhoto({ quality: 100, webUseInput: true })
    return [await optimizePhoto(await load(photo.webPath))]
  })

/** Up to `limit` saved photos, in the order chosen, optimized (`[]` if cancelled). */
export const choosePhotos = (limit: number) =>
  unlessCancelled(async () => {
    const { results } = await Camera.chooseFromGallery({
      allowMultipleSelection: limit > 1,
      limit,
      webUseInput: true,
    })
    // `limit` isn't enforced everywhere (web, older Android), so cap it here too.
    return Promise.all(
      results.slice(0, limit).map(async (photo) => optimizePhoto(await load(photo.webPath))),
    )
  })
