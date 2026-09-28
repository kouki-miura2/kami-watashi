import { LIMITS } from 'utils'
import { afterEach, beforeEach, expect, test, vi } from 'vite-plus/test'

import type { ChildRepository } from '../repository/child.repository.ts'
import type { PrintRepository } from '../repository/print.repository.ts'
import { invitedUser } from '../testing.ts'
import { createStatsService } from './stats.service.ts'

// Wednesday 2026-09-30 12:00 JST: this week started Mon 2026-09-28, this month on 2026-09-01.
const now = Date.UTC(2026, 8, 30, 3)
const jst = (iso: string) => new Date(`${iso}+09:00`).getTime()

const createService = (prints: { childId: string | null; createdAt: number }[]) => {
  const listCreatedSince = vi.fn<PrintRepository['listCreatedSince']>(async () => prints)
  const service = createStatsService({
    printRepository: {
      listCreatedSince,
      storageUsed: async () => 12_345,
    } as unknown as PrintRepository,
    childRepository: {
      listByFamily: async () => [
        { id: 'c1', familyId: 'f1', name: 'はなこ' },
        { id: 'c2', familyId: 'f1', name: 'たろう' },
      ],
    } as unknown as ChildRepository,
  })
  return { service, listCreatedSince }
}

beforeEach(() => {
  vi.useFakeTimers({ now })
})

afterEach(() => {
  vi.useRealTimers()
})

test('covers the configured weeks and months, oldest first, ending with the current ones', async () => {
  const { service, listCreatedSince } = createService([])

  const stats = await service.get(invitedUser)

  expect(stats.weekly).toHaveLength(LIMITS.statsWeeks)
  expect(stats.weekly.at(-1)?.start).toBe('2026-09-28')
  expect(stats.weekly.at(-2)?.start).toBe('2026-09-21')
  expect(stats.monthly).toHaveLength(LIMITS.statsMonths)
  expect(stats.monthly.at(-1)?.start).toBe('2026-09-01')
  expect(stats.monthly[0].start).toBe('2025-10-01')
  // Reads from the earlier of the two ranges (12 months back is earlier than 12 weeks back).
  expect(listCreatedSince).toHaveBeenCalledWith('f1', jst('2025-10-01T00:00:00'))
})

test('counts each print in its JST week and month, per slot, with zeros for empty slots', async () => {
  const { service } = createService([
    { childId: 'c1', createdAt: jst('2026-09-28T00:00:00') }, // Monday 00:00 JST: this week
    { childId: 'c1', createdAt: jst('2026-09-27T23:59:59') }, // Sunday: last week
    { childId: null, createdAt: jst('2026-09-01T00:00:00') }, // this month, 4 weeks back
    { childId: null, createdAt: jst('2026-08-31T23:59:59') }, // last month
  ])

  const stats = await service.get(invitedUser)

  expect(stats.weekly.at(-1)?.counts).toEqual({ common: 0, c1: 1, c2: 0 })
  expect(stats.weekly.at(-2)?.counts).toEqual({ common: 0, c1: 1, c2: 0 })
  expect(stats.weekly.find((week) => week.start === '2026-08-31')?.counts).toEqual({
    common: 2,
    c1: 0,
    c2: 0,
  })
  expect(stats.monthly.at(-1)?.counts).toEqual({ common: 1, c1: 2, c2: 0 })
  expect(stats.monthly.at(-2)?.counts).toEqual({ common: 1, c1: 0, c2: 0 })
})

test('reports storage use against the family quota', async () => {
  const { service } = createService([])

  expect((await service.get(invitedUser)).storage).toEqual({
    usedBytes: 12_345,
    limitBytes: LIMITS.familyStorageBytes,
  })
})
