/** Time left until `expiresAt` as `mm:ss` (rounded up to the second, never negative). */
export const formatCountdown = (expiresAt: number, now: number): string => {
  const seconds = Math.max(0, Math.ceil((expiresAt - now) / 1000))
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`
}
