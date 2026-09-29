/** The query parameter carrying the invite token in the invite URL. */
const INVITE_PARAM = 'invite'

/**
 * The invite URL in the owner's QR code (5b): `https://<web app>/join?invite=<token>`. Whether it is
 * read in the app's own join screen or opened from the phone's camera, it lands on joining.
 */
export const inviteUrl = (origin: string, inviteToken: string): string => {
  const url = new URL('/join', origin)
  url.searchParams.set(INVITE_PARAM, inviteToken)
  return url.href
}

/** The invite token in the join screen's query (`?invite=...`), if any. */
export const inviteTokenFromQuery = (query: Record<string, unknown>): string | null => {
  const value = query[INVITE_PARAM]
  return typeof value === 'string' && value !== '' ? value : null
}

/**
 * The invite token in a scanned QR code, or `null` if it isn't this app's invite URL (another app's
 * QR code, or one pointing to another site).
 */
export const inviteTokenFromScan = (text: string, origin: string): string | null => {
  let url: URL
  try {
    url = new URL(text)
  } catch {
    return null
  }
  if (url.origin !== origin || url.pathname !== '/join') return null
  return inviteTokenFromQuery(Object.fromEntries(url.searchParams))
}
