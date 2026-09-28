import { expect, test } from 'vite-plus/test'

import { isCancellation } from './cancellation.ts'

test('recognizes a user backing out of a device feature', () => {
  expect(isCancellation(new Error('User cancelled photos app'))).toBe(true)
  expect(isCancellation(new Error('Camera permission denied'))).toBe(false)
  expect(isCancellation(new Error('scan canceled.'))).toBe(true)
  expect(isCancellation('cancel')).toBe(false)
})
