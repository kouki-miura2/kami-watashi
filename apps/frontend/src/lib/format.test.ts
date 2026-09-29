import { expect, test } from 'vite-plus/test'

import {
  formatJstMonthDayTime,
  formatMegabytes,
  formatMonthDay,
  formatMonthDayWithWeekday,
  weekdayOf,
} from './format.ts'

test('weekdayOf gives the Japanese weekday of a calendar date', () => {
  expect(weekdayOf('2026-09-28')).toBe('月')
  expect(weekdayOf('2026-10-04')).toBe('日')
})

test('formatMonthDay drops the year and the leading zeros', () => {
  expect(formatMonthDay('2026-09-29')).toBe('9/29')
  expect(formatMonthDay('2026-10-03')).toBe('10/3')
})

test('formatMonthDayWithWeekday adds the weekday in parentheses', () => {
  expect(formatMonthDayWithWeekday('2026-09-29')).toBe('9/29(火)')
})

test('formatJstMonthDayTime uses the JST date and time, not UTC', () => {
  // 2026-09-29 01:21 UTC is 10:21 the same day in JST; 15:30 UTC is 00:30 the next day.
  expect(formatJstMonthDayTime(new Date('2026-09-29T01:21:00Z'))).toBe('9/29 10:21')
  expect(formatJstMonthDayTime(new Date('2026-09-27T15:30:00Z'))).toBe('9/28 00:30')
})

test('formatMegabytes shows binary megabytes to one decimal', () => {
  expect(formatMegabytes(100 * 1024 * 1024)).toBe('100.0')
  expect(formatMegabytes(65_431_142)).toBe('62.4')
  expect(formatMegabytes(0)).toBe('0.0')
})
