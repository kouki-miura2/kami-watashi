import { weekdayOf } from './format.ts'

/** A print's name everywhere it's shown (and in history): `はなこのプリント（00012）`. */
export const formatPrintLabel = (slotName: string, seq: number): string =>
  `${slotName}のプリント（${String(seq).padStart(5, '0')}）`

/** A `YYYY-MM-DD` date in the app's display format: `2026.09.25`. */
export const formatDateString = (dateString: string): string => dateString.replaceAll('-', '.')

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

/** A due date as the due-order list's calendar tile: `{ month: 'OCT', day: '03', weekday: '土' }`. */
export const calendarTile = (dateString: string) => ({
  month: MONTHS[Number(dateString.slice(5, 7)) - 1]!,
  day: dateString.slice(8, 10),
  weekday: weekdayOf(dateString),
})

const addDays = (dateString: string, days: number): string => {
  const date = new Date(`${dateString}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** The Sunday ending the calendar week (Monday start, as the spec's weeks) of a `YYYY-MM-DD` date. */
export const endOfWeek = (dateString: string): string => {
  const daysSinceMonday = (new Date(`${dateString}T00:00:00Z`).getUTCDay() + 6) % 7
  return addDays(dateString, 6 - daysSinceMonday)
}

export type DueGroupKind = 'overdue' | 'thisWeek' | 'later'

export interface DueGroup<T> {
  kind: DueGroupKind
  label: string
  items: T[]
}

const DUE_GROUP_LABELS: Record<DueGroupKind, string> = {
  overdue: '期限切れ・未対応',
  thisWeek: '今週',
  later: 'それ以降',
}

/**
 * The due-order list (2c) split into 期限切れ・未対応 / 今週 / それ以降, keeping the API's order
 * (earliest due first) and leaving out empty groups. The API already drops past-due prints that are
 * not 未対応, so everything before `today` here is overdue and still to do.
 */
export const groupByDue = <T extends { dueOn: string | null }>(
  items: T[],
  today: string,
): DueGroup<T>[] => {
  const weekEnd = endOfWeek(today)
  const kindOf = (dueOn: string): DueGroupKind =>
    dueOn < today ? 'overdue' : dueOn <= weekEnd ? 'thisWeek' : 'later'
  const groups: DueGroup<T>[] = (['overdue', 'thisWeek', 'later'] as const).map((kind) => ({
    kind,
    label: DUE_GROUP_LABELS[kind],
    items: [],
  }))
  for (const item of items) {
    if (item.dueOn) groups.find((group) => group.kind === kindOf(item.dueOn!))!.items.push(item)
  }
  return groups.filter((group) => group.items.length > 0)
}
