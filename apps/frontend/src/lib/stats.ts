export interface StatsPeriod {
  /** First day of the week or month, `YYYY-MM-DD`. */
  start: string
  /** Prints registered in the period, per slot (`slotParam`: a child id, or `common`). */
  counts: Record<string, number>
}

export interface ChartSlot {
  param: string
  name: string
  color: string
}

/**
 * A stacked bar chart of registrations (6b): one bar per period, oldest first, the latest labeled
 * 今週 / 今月; one dataset per slot, in the home list's order (children, then 家族共通).
 */
export const toRegistrationChart = (
  periods: StatsPeriod[],
  slots: ChartSlot[],
  unit: 'week' | 'month',
) => ({
  labels: periods.map((period, index) =>
    index === periods.length - 1
      ? unit === 'week'
        ? '今週'
        : '今月'
      : unit === 'week'
        ? period.start.slice(5).replace('-', '.')
        : `${Number(period.start.slice(5, 7))}月`,
  ),
  datasets: slots.map((slot) => ({
    label: slot.name,
    backgroundColor: slot.color,
    data: periods.map((period) => period.counts[slot.param] ?? 0),
  })),
})

/** Storage use as a whole percentage, capped at 100. */
export const usagePercent = (usedBytes: number, limitBytes: number): number =>
  Math.min(100, Math.round((usedBytes / limitBytes) * 100))
