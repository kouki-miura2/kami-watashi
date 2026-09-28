import { expect, test } from 'vite-plus/test'

import { formatJstDateWithWeekday, formatMegabytes, weekdayOf } from './format.ts'

test('weekdayOf gives the Japanese weekday of a calendar date', () => {
  expect(weekdayOf('2026-09-28')).toBe('月')
  expect(weekdayOf('2026-10-04')).toBe('日')
})

test('formatJstDateWithWeekday uses the JST date, not UTC', () => {
  // 2026-09-27 15:30 UTC is Monday 2026-09-28 00:30 in JST.
  expect(formatJstDateWithWeekday(new Date('2026-09-27T15:30:00Z'))).toBe('2026.09.28 月')
})

test('formatMegabytes shows binary megabytes to one decimal', () => {
  expect(formatMegabytes(100 * 1024 * 1024)).toBe('100.0')
  expect(formatMegabytes(65_431_142)).toBe('62.4')
  expect(formatMegabytes(0)).toBe('0.0')
})
