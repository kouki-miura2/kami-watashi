// Japan has no DST, so JST is always UTC+9. Shifting an instant by this offset and reading it
// with the UTC getters gives the JST wall-clock date, independent of the runtime's time zone.
const JST_OFFSET_MS = 9 * 60 * 60 * 1000

const toJstWallClock = (date: Date): Date => new Date(date.getTime() + JST_OFFSET_MS)

const fromJstWallClock = (wallClock: Date): Date => new Date(wallClock.getTime() - JST_OFFSET_MS)

const pad = (value: number): string => String(value).padStart(2, '0')

/** JST calendar date of an instant, as `YYYY-MM-DD` (the format of `prints.received_on` / `due_on`). */
export const toJstDateString = (date: Date): string => {
  const wall = toJstWallClock(date)
  return `${wall.getUTCFullYear()}-${pad(wall.getUTCMonth() + 1)}-${pad(wall.getUTCDate())}`
}

/** JST calendar date of an instant in the app's display format: `2026.09.27`. */
export const formatJstDate = (date: Date): string => toJstDateString(date).replaceAll('-', '.')

/** JST date and time (to the minute) of an instant in the app's display format: `2026.09.27 12:40`. */
export const formatJstDateTime = (date: Date): string => {
  const wall = toJstWallClock(date)
  return `${formatJstDate(date)} ${pad(wall.getUTCHours())}:${pad(wall.getUTCMinutes())}`
}

/** Start (00:00 JST) of the calendar week containing `date`. Weeks start on Monday. */
export const startOfJstWeek = (date: Date): Date => {
  const wall = toJstWallClock(date)
  const daysSinceMonday = (wall.getUTCDay() + 6) % 7
  return fromJstWallClock(
    new Date(
      Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate() - daysSinceMonday),
    ),
  )
}

/** Start (00:00 JST on the 1st) of the calendar month containing `date`. */
export const startOfJstMonth = (date: Date): Date => {
  const wall = toJstWallClock(date)
  return fromJstWallClock(new Date(Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), 1)))
}

/**
 * Moves `date` by `months` calendar months in JST, keeping the time of day. The day is clamped to
 * the target month's last day (e.g. Mar 31 minus 1 month is Feb 28/29, not Mar 3).
 */
export const addJstMonths = (date: Date, months: number): Date => {
  const wall = toJstWallClock(date)
  const year = wall.getUTCFullYear()
  const month = wall.getUTCMonth() + months
  const lastDayOfTargetMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const result = new Date(wall)
  result.setUTCFullYear(year, month, Math.min(wall.getUTCDate(), lastDayOfTargetMonth))
  return fromJstWallClock(result)
}
