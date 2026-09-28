import { expect, test } from 'vite-plus/test'

import { toRegistrationChart, usagePercent } from './stats.ts'

const slots = [
  { param: 'c1', name: 'はなこ', color: '#D9542B' },
  { param: 'common', name: '家族共通', color: '#6B665C' },
]

test('weekly bars are labeled by their Monday, the latest as 今週', () => {
  const chart = toRegistrationChart(
    [
      { start: '2026-09-21', counts: { c1: 2, common: 1 } },
      { start: '2026-09-28', counts: { c1: 0, common: 3 } },
    ],
    slots,
    'week',
  )

  expect(chart.labels).toEqual(['09.21', '今週'])
  expect(chart.datasets).toEqual([
    { label: 'はなこ', backgroundColor: '#D9542B', data: [2, 0] },
    { label: '家族共通', backgroundColor: '#6B665C', data: [1, 3] },
  ])
})

test('monthly bars are labeled by month, the latest as 今月', () => {
  const chart = toRegistrationChart(
    [
      { start: '2026-08-01', counts: {} },
      { start: '2026-09-01', counts: { c1: 4 } },
    ],
    slots,
    'month',
  )

  expect(chart.labels).toEqual(['8月', '今月'])
  // A slot missing from a period counts as none.
  expect(chart.datasets[0]!.data).toEqual([0, 4])
})

test('usagePercent rounds and caps at 100', () => {
  expect(usagePercent(62.4, 100)).toBe(62)
  expect(usagePercent(120, 100)).toBe(100)
  expect(usagePercent(0, 100)).toBe(0)
})
