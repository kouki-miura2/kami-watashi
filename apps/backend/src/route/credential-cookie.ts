import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import type { CookieOptions } from 'hono/utils/cookie'

import type { SessionView } from '../service/auth.service.ts'

/**
 * The cookie carrying this browser's credential (spec "認証"): an owner's session token or an
 * invited member's key. HttpOnly, so the web app never sees it; `__Host-` (Secure, `Path=/`, no
 * `Domain`) keeps it on the API's own host. `SameSite=Lax` still sends it from the web app, which
 * is served on the same site (spec "アーキテクチャ"). Browsers treat `http://localhost` as secure,
 * so it works in local development too (Chrome/Edge/Firefox; Safari refuses Secure cookies there).
 */
const NAME = 'credential'
const OPTIONS: CookieOptions = {
  prefix: 'host',
  httpOnly: true,
  secure: true,
  sameSite: 'Lax',
  path: '/',
}

/** Browsers cap a cookie at 400 days. A member key never expires by itself; each launch renews the cookie. */
const MEMBER_KEY_MAX_AGE_S = 400 * 24 * 60 * 60

export const readCredential = (c: Context): string | undefined => getCookie(c, NAME, 'host')

/** An owner's session, expiring with the session token itself. */
export const setSessionCookie = (c: Context, session: SessionView): void =>
  setCookie(c, NAME, session.sessionToken, { ...OPTIONS, expires: new Date(session.expiresAt) })

export const setMemberKeyCookie = (c: Context, memberKey: string): void =>
  setCookie(c, NAME, memberKey, { ...OPTIONS, maxAge: MEMBER_KEY_MAX_AGE_S })

/** On withdrawal/leaving, and when a sent credential no longer works. */
export const clearCredentialCookie = (c: Context): void => {
  deleteCookie(c, NAME, OPTIONS)
}
