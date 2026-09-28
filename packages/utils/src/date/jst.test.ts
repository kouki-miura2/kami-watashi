import { expect, test } from 'vite-plus/test'

import { addJstMonths, startOfJstMonth, startOfJstWeek, toJstDateString } from './jst.ts'

test('toJstDateString uses the JST calendar date, not UTC', () => {
  // 2026-09-27 15:30 UTC is already 2026-09-28 00:30 in JST.
  expect(toJstDateString(new Date('2026-09-27T15:30:00Z'))).toBe('2026-09-28')
  expect(toJstDateString(new Date('2026-09-27T14:59:59Z'))).toBe('2026-09-27')
})

test('startOfJstWeek returns Monday 00:00 JST', () => {
  // Sunday 2026-10-04 23:00 JST belongs to the week starting Monday 2026-09-28.
  expect(startOfJstWeek(new Date('2026-10-04T14:00:00Z')).toISOString()).toBe(
    '2026-09-27T15:00:00.000Z',
  )
  // Monday 2026-10-05 00:00 JST starts a new week.
  expect(startOfJstWeek(new Date('2026-10-04T15:00:00Z')).toISOString()).toBe(
    '2026-10-04T15:00:00.000Z',
  )
})

test('startOfJstMonth returns the 1st at 00:00 JST', () => {
  // 2026-09-30 16:00 UTC is 2026-10-01 01:00 JST.
  expect(startOfJstMonth(new Date('2026-09-30T16:00:00Z')).toISOString()).toBe(
    '2026-09-30T15:00:00.000Z',
  )
})

test('addJstMonths moves by calendar months in JST and clamps the day', () => {
  expect(addJstMonths(new Date('2026-09-28T03:00:00Z'), -3).toISOString()).toBe(
    '2026-06-28T03:00:00.000Z',
  )
  // 2026-03-31 09:00 JST minus 1 month is 2026-02-28 09:00 JST.
  expect(addJstMonths(new Date('2026-03-31T00:00:00Z'), -1).toISOString()).toBe(
    '2026-02-28T00:00:00.000Z',
  )
  expect(addJstMonths(new Date('2026-01-15T00:00:00Z'), -12).toISOString()).toBe(
    '2025-01-15T00:00:00.000Z',
  )
})
