import { LIMITS } from 'utils'

import { fitLongEdge } from '../lib/photos.ts'

const WEBP = 'image/webp'

/**
 * Encodes the canvas as WebP. Browsers that can't (Safari, so every iPhone browser) silently hand
 * back a PNG instead, so those fall back to libwebp compiled to WebAssembly, loaded only then.
 */
const toWebp = async (canvas: HTMLCanvasElement): Promise<Blob> => {
  const native = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, WEBP, LIMITS.imageQuality),
  )
  if (native?.type === WEBP) return native
  const { default: encode } = await import('@jsquash/webp/encode')
  const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height)
  return new Blob([await encode(pixels, { quality: LIMITS.imageQuality * 100 })], { type: WEBP })
}

/**
 * Re-encodes a photo the way the spec stores it: downscaled to `LIMITS.imageLongEdgePx` on the long
 * edge (only if larger), WebP at `LIMITS.imageQuality`. Drawing it onto a canvas drops the EXIF
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
  return toWebp(canvas)
}

/**
 * `photo` turned clockwise by `quarterTurns` × 90°, re-encoded like `optimizePhoto`. Rotate from
 * the photo as first optimized, not from an already rotated one, so it's re-encoded only once.
 */
export const rotatePhoto = async (photo: Blob, quarterTurns: number): Promise<Blob> => {
  const bitmap = await createImageBitmap(photo)
  const sideways = quarterTurns % 2 === 1
  const canvas = document.createElement('canvas')
  canvas.width = sideways ? bitmap.height : bitmap.width
  canvas.height = sideways ? bitmap.width : bitmap.height
  const context = canvas.getContext('2d')!
  context.translate(canvas.width / 2, canvas.height / 2)
  context.rotate((quarterTurns * Math.PI) / 2)
  context.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2)
  bitmap.close()
  return toWebp(canvas)
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
