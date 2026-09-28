import { LIMITS, addJstMonths, startOfJstMonth, startOfJstWeek, toJstDateString } from 'utils'

import type { AuthenticatedUser } from '../repository/auth-guard.interface.ts'
import type { ChildRepository } from '../repository/child.repository.ts'
import type { PrintRepository } from '../repository/print.repository.ts'

/** Key of the family-common slot in `counts` (child ids otherwise). */
export const COMMON_SLOT_KEY = 'common'

export interface StatsPeriodView {
  /** First day of the week (Monday) or month, JST `YYYY-MM-DD`. */
  start: string
  /** Prints registered in the period per slot: every current child, and `common`. */
  counts: Record<string, number>
}

export interface StatsView {
  /** The last `LIMITS.statsWeeks` calendar weeks, oldest first, including this one. */
  weekly: StatsPeriodView[]
  /** The last `LIMITS.statsMonths` calendar months, oldest first, including this one. */
  monthly: StatsPeriodView[]
  storage: { usedBytes: number; limitBytes: number }
}

export interface StatsService {
  get: (user: AuthenticatedUser) => Promise<StatsView>
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/** Oldest first: `count` periods ending with the one starting at `current`. */
const periodStarts = (count: number, current: Date, back: (date: Date, n: number) => Date) =>
  Array.from({ length: count }, (_, index) => back(current, count - 1 - index))

export const createStatsService = (deps: {
  printRepository: PrintRepository
  childRepository: ChildRepository
}): StatsService => ({
  get: async (user) => {
    const now = new Date()
    // JST has no DST, so a week is always exactly 7 days.
    const weekStarts = periodStarts(
      LIMITS.statsWeeks,
      startOfJstWeek(now),
      (date, n) => new Date(date.getTime() - n * WEEK_MS),
    )
    const monthStarts = periodStarts(LIMITS.statsMonths, startOfJstMonth(now), (date, n) =>
      addJstMonths(date, -n),
    )
    const since = Math.min(weekStarts[0].getTime(), monthStarts[0].getTime())

    // Counts current prints only (spec: deleted prints aren't counted), by registration time.
    const [children, prints, usedBytes] = await Promise.all([
      deps.childRepository.listByFamily(user.familyId),
      deps.printRepository.listCreatedSince(user.familyId, since),
      deps.printRepository.storageUsed(user.familyId),
    ])
    const slotKeys = [COMMON_SLOT_KEY, ...children.map((child) => child.id)]

    const tally = (starts: Date[]): StatsPeriodView[] => {
      const periods = starts.map((start) => ({
        start: toJstDateString(start),
        counts: Object.fromEntries(slotKeys.map((key) => [key, 0])),
      }))
      for (const print of prints) {
        const index = starts.findLastIndex((start) => start.getTime() <= print.createdAt)
        if (index < 0) continue
        const key = print.childId ?? COMMON_SLOT_KEY
        periods[index].counts[key] = (periods[index].counts[key] ?? 0) + 1
      }
      return periods
    }

    return {
      weekly: tally(weekStarts),
      monthly: tally(monthStarts),
      storage: { usedBytes, limitBytes: LIMITS.familyStorageBytes },
    }
  },
})
