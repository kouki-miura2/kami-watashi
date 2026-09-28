import { expect, test } from 'vite-plus/test'

import { formatCountdown } from './countdown.ts'

test('formats the time left as mm:ss', () => {
  expect(formatCountdown(10 * 60 * 1000, 0)).toBe('10:00')
  expect(formatCountdown(582_000, 0)).toBe('09:42')
})

test('rounds a partial second up, so it reads 00:00 only once expired', () => {
  expect(formatCountdown(1_000, 1)).toBe('00:01')
  expect(formatCountdown(1_000, 1_000)).toBe('00:00')
})

test('never goes negative', () => {
  expect(formatCountdown(0, 5_000)).toBe('00:00')
})
