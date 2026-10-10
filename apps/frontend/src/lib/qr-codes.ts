import jsQR, { type QRCode } from 'jsqr'
import { LIMITS } from 'utils'

type DetectedCode = { code: QRCode; x: number; y: number }

/** jsQR can mix finder patterns from different codes. Overlapping crops isolate them. */
const findCode = (data: Uint8ClampedArray, width: number, height: number) => {
  const search = (
    x: number,
    y: number,
    w: number,
    h: number,
    depth: number,
  ): DetectedCode | undefined => {
    const pixels = w === width && h === height ? data : new Uint8ClampedArray(w * h * 4)
    if (pixels !== data) {
      for (let row = 0; row < h; row++) {
        const offset = ((y + row) * width + x) * 4
        pixels.set(data.subarray(offset, offset + w * 4), row * w * 4)
      }
    }
    const code = jsQR(pixels, w, h, { inversionAttempts: 'attemptBoth' })
    if (code) return { code, x, y }
    // Bound work on photos without codes. Each split keeps an overlap at the boundary.
    if (depth === 6 || Math.max(w, h) <= 64) return undefined
    if (w >= h) {
      const size = Math.ceil(w * 0.6)
      return search(x, y, size, h, depth + 1) ?? search(x + w - size, y, size, h, depth + 1)
    }
    const size = Math.ceil(h * 0.6)
    return search(x, y, w, size, depth + 1) ?? search(x, y + h - size, w, size, depth + 1)
  }
  return search(0, 0, width, height, 0)
}

/** Whiten only the detected quadrilateral, preserving neighbouring codes on tilted photos. */
const excludeCode = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  detected: DetectedCode,
) => {
  const { code, x, y: offsetY } = detected
  const { topLeftCorner, topRightCorner, bottomRightCorner, bottomLeftCorner } = code.location
  const corners = [topLeftCorner, topRightCorner, bottomRightCorner, bottomLeftCorner].map(
    (point) => ({ x: point.x + x, y: point.y + offsetY }),
  )
  const startY = Math.max(0, Math.floor(Math.min(...corners.map((point) => point.y))))
  const endY = Math.min(height - 1, Math.ceil(Math.max(...corners.map((point) => point.y))))
  for (let y = startY; y <= endY; y++) {
    const intersections: number[] = []
    for (let i = 0; i < corners.length; i++) {
      const a = corners[i]!
      const b = corners[(i + 1) % corners.length]!
      if (a.y === b.y) {
        if (Math.abs(y - a.y) <= 0.5) intersections.push(a.x, b.x)
      } else if (y >= Math.min(a.y, b.y) && y <= Math.max(a.y, b.y)) {
        intersections.push(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y))
      }
    }
    if (intersections.length < 2) continue
    const startX = Math.max(0, Math.floor(Math.min(...intersections)))
    const endX = Math.min(width - 1, Math.ceil(Math.max(...intersections)))
    data.fill(255, (y * width + startX) * 4, (y * width + endX + 1) * 4)
  }
}

/** Search again after each exclusion, including one extra code to detect overflow. */
export const findQrCodes = (
  pixels: { data: Uint8ClampedArray; width: number; height: number },
  limit: number = LIMITS.printQrCodes,
) => {
  const data = new Uint8ClampedArray(pixels.data)
  const codes: string[] = []
  for (let i = 0; i <= limit; i++) {
    const detected = findCode(data, pixels.width, pixels.height)
    if (!detected) break
    codes.push(detected.code.data)
    if (codes.length > limit) break
    excludeCode(data, pixels.width, pixels.height, detected)
  }
  return codes
}

/** Browser links and app schemes; executable and local-resource URLs remain plain text. */
export const qrCodeLink = (text: string): string | undefined => {
  const value = text.trim()
  for (const char of value) {
    if (char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127) return undefined
  }
  try {
    const url = new URL(value)
    if (['http:', 'https:', 'mailto:', 'tel:', 'sms:', 'geo:'].includes(url.protocol))
      return url.href
    if (
      /^[a-z][a-z0-9+.-]*:\/\//i.test(value) &&
      ![
        'javascript:',
        'data:',
        'file:',
        'blob:',
        'about:',
        'vbscript:',
        'intent:',
        'chrome:',
        'chrome-extension:',
        'edge:',
        'moz-extension:',
        'safari-extension:',
        'resource:',
        'view-source:',
      ].includes(url.protocol)
    )
      return value
  } catch {
    // QR codes can contain arbitrary text, not just links.
  }
  return undefined
}
