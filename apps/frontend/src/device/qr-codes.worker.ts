import { findQrCodes } from '../lib/qr-codes.ts'

self.onmessage = ({
  data,
}: MessageEvent<{ data: Uint8ClampedArray; width: number; height: number; limit: number }>) => {
  self.postMessage(findQrCodes(data, data.limit))
}
