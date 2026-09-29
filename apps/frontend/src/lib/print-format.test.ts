import { expect, test } from 'vite-plus/test'

import { endOfWeek, formatDateString, formatPrintLabel, groupByDue } from './print-format.ts'

test('formatPrintLabel pads the number to five digits', () => {
  expect(formatPrintLabel('はなこ', 12)).toBe('はなこのプリント（00012）')
  expect(formatPrintLabel('家族共通', 1)).toBe('家族共通のプリント（00001）')
})

test('formatDateString uses dots', () => {
  expect(formatDateString('2026-09-25')).toBe('2026.09.25')
})

test('endOfWeek is the Sunday of the Monday-start week', () => {
  expect(endOfWeek('2026-09-28')).toBe('2026-10-04') // Monday
  expect(endOfWeek('2026-10-04')).toBe('2026-10-04') // Sunday
  expect(endOfWeek('2026-12-30')).toBe('2027-01-03') // across the year
})

test('groupByDue splits into overdue, this week, and later, keeping the order', () => {
  const items = [
    { id: 'a', dueOn: '2026-09-26' },
    { id: 'b', dueOn: '2026-09-28' },
    { id: 'c', dueOn: '2026-10-04' },
    { id: 'd', dueOn: '2026-10-05' },
  ]

  expect(
    groupByDue(items, '2026-09-28').map((group) => [
      group.label,
      group.items.map((item) => item.id),
    ]),
  ).toEqual([
    ['期限切れ・未対応', ['a']],
    ['今週', ['b', 'c']],
    ['それ以降', ['d']],
  ])
})

test('groupByDue leaves out empty groups and prints without a due date', () => {
  expect(
    groupByDue(
      [
        { id: 'a', dueOn: null },
        { id: 'b', dueOn: '2026-11-14' },
      ],
      '2026-09-28',
    ).map((group) => group.kind),
  ).toEqual(['later'])
})
