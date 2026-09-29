import { formatJstDateTime, toJstDateString } from 'utils'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

/** Japanese weekday of a `YYYY-MM-DD` calendar date: `月`. */
export const weekdayOf = (dateString: string): string =>
  WEEKDAYS[new Date(`${dateString}T00:00:00Z`).getUTCDay()]!

/** A `YYYY-MM-DD` date without its year — the format of every yearless date in the app: `9/29`. */
export const formatMonthDay = (dateString: string): string =>
  `${Number(dateString.slice(5, 7))}/${Number(dateString.slice(8, 10))}`

/** A `YYYY-MM-DD` date without its year, with its weekday (the home screen's date): `9/29(火)`. */
export const formatMonthDayWithWeekday = (dateString: string): string =>
  `${formatMonthDay(dateString)}(${weekdayOf(dateString)})`

/** JST date and time (to the minute) of an instant without its year: `9/29 10:21`. */
export const formatJstMonthDayTime = (date: Date): string =>
  // `formatJstDateTime` ends in the `HH:MM` time.
  `${formatMonthDay(toJstDateString(date))} ${formatJstDateTime(date).slice(-5)}`

/** A byte size in MB (1 MB = 1024 × 1024 bytes, as the storage quota) to one decimal: `62.4`. */
export const formatMegabytes = (bytes: number): string => (bytes / (1024 * 1024)).toFixed(1)
