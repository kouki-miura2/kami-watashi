import QRCode from 'qrcode'
import { LIMITS } from 'utils'
import { expect, test } from 'vite-plus/test'

import { findQrCodes, qrCodeLink } from './qr-codes.ts'

/** Real generated QR pixels exercise the decoder and exclusion, without browser globals. */
const photo = (texts: string[], inverted = false, angle = 0) => {
  const cell = 180
  const columns = Math.min(3, Math.max(1, texts.length))
  const width = cell * columns
  const height = cell * Math.max(1, Math.ceil(texts.length / columns))
  const data = new Uint8ClampedArray(width * height * 4).fill(255)
  for (const [index, text] of texts.entries()) {
    const { modules } = QRCode.create(text)
    const offsetX = (index % columns) * cell
    const offsetY = Math.floor(index / columns) * cell
    for (let y = 0; y < cell; y++) {
      for (let x = 0; x < cell; x++) {
        const dx = x - cell / 2
        const dy = y - cell / 2
        const row = Math.floor(
          (-dx * Math.sin(angle) + dy * Math.cos(angle)) / 4 + modules.size / 2,
        )
        const col = Math.floor((dx * Math.cos(angle) + dy * Math.sin(angle)) / 4 + modules.size / 2)
        const inside = row >= 0 && row < modules.size && col >= 0 && col < modules.size
        const dark = inside && Boolean(modules.get(row, col))
        const value = dark !== inverted ? 0 : 255
        const pixel = ((offsetY + y) * width + offsetX + x) * 4
        data[pixel] = data[pixel + 1] = data[pixel + 2] = value
      }
    }
  }
  return { data, width, height }
}

test('an empty photo has no QR codes', () => {
  expect(findQrCodes(photo([]))).toEqual([])
})

test.each([1, 2, LIMITS.printQrCodes, LIMITS.printQrCodes + 1])(
  'detects %i physical codes by excluding each detected region',
  (count) => {
    const texts = Array.from({ length: count }, (_, index) => `https://qr.test/${index}`)
    expect(findQrCodes(photo(texts)).sort()).toEqual(texts.sort())
  },
)

test('identical URLs in separate QR codes count separately', () => {
  const texts = ['https://qr.test/same', 'https://qr.test/same']
  expect(findQrCodes(photo(texts))).toEqual(texts)
})

test('tilted and inverted codes can be excluded and scanned repeatedly', () => {
  const texts = ['first', 'second', 'third']
  expect(findQrCodes(photo(texts, true, Math.PI / 6)).sort()).toEqual(texts.sort())
})

test('only searches through one extra code beyond the remaining limit', () => {
  expect(findQrCodes(photo(['one', 'two', 'three']), 1)).toHaveLength(2)
  expect(findQrCodes(photo(['one']), 0)).toHaveLength(1)
})

test('ten codes still return only nine detections for the overflow error', () => {
  const codes = findQrCodes(
    photo(Array.from({ length: 10 }, (_, index) => `https://qr.test/${index}`)),
  )
  expect(codes).toHaveLength(LIMITS.printQrCodes + 1)
  expect(new Set(codes).size).toBe(LIMITS.printQrCodes + 1)
})

test('exclusion preserves the original photo pixels', () => {
  const pixels = photo(['https://qr.test/'])
  const original = pixels.data.slice()
  expect(findQrCodes(pixels)).toHaveLength(1)
  expect(pixels.data).toEqual(original)
})

test.each([
  'https://example.com/form',
  'http://example.com/',
  'mailto:test@example.com',
  'tel:0123456789',
  'line://ti/p/example',
])('accepts link %s', (value) => {
  expect(qrCodeLink(value)).toBe(value)
})

test.each([
  'ordinary text',
  'javascript:alert(1)',
  'javascript://example.com',
  'data:text/html,test',
  'file:///C:/test',
  'blob:https://example.com/id',
  'intent://test',
  'java\nscript:alert(1)',
  '/relative',
  'https://',
])('keeps non-link or executable content as text: %s', (value) => {
  expect(qrCodeLink(value)).toBeUndefined()
})
