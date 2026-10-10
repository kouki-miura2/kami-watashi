import { LIMITS } from 'utils'

/** Decode the saved photo at its stored resolution, without changing the photo. */
export const readPhotoQrCodes = async (photo: Blob, limit: number = LIMITS.printQrCodes) => {
  const bitmap = await createImageBitmap(photo)
  let worker: Worker | undefined
  try {
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d', { willReadFrequently: true })!
    context.drawImage(bitmap, 0, 0)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
    // Repeated full-resolution scans must not block navigation or the loading indicator.
    worker = new Worker(new URL('./qr-codes.worker.ts', import.meta.url), { type: 'module' })
    return await new Promise<string[]>((resolve, reject) => {
      worker!.onmessage = ({ data }: MessageEvent<string[]>) => resolve(data)
      worker!.onerror = () => reject(new Error('QR code decoding failed'))
      worker!.postMessage(
        { data: pixels.data, width: pixels.width, height: pixels.height, limit },
        [pixels.data.buffer],
      )
    })
  } finally {
    worker?.terminate()
    bitmap.close()
  }
}
