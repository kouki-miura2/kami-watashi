import { formatJstDate, toJstDateString } from 'utils'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

/** Japanese weekday of a `YYYY-MM-DD` calendar date: `月`. */
export const weekdayOf = (dateString: string): string =>
  WEEKDAYS[new Date(`${dateString}T00:00:00Z`).getUTCDay()]!

/** Today's JST date with its weekday, as on the home screen: `2026.09.28 月`. */
export const formatJstDateWithWeekday = (date: Date): string =>
  `${formatJstDate(date)} ${weekdayOf(toJstDateString(date))}`

/** A byte size in MB (1 MB = 1024 × 1024 bytes, as the storage quota) to one decimal: `62.4`. */
export const formatMegabytes = (bytes: number): string => (bytes / (1024 * 1024)).toFixed(1)
