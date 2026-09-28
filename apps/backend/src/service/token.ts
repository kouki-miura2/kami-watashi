import { sign, verify } from 'hono/jwt'
import { JwtTokenExpired } from 'hono/utils/jwt/types'
import { LIMITS } from 'utils'

// Signed tokens (owner sessions and invite tokens) share one secret, so `typ` is checked on
// verify to keep one kind from being accepted as another.
const ALGORITHM = 'HS256'
const MEMBER_KEY_PREFIX = 'mk_'

export interface SessionClaims {
  memberId: string
  familyId: string
}

export interface IssuedToken {
  token: string
  /** Unix epoch milliseconds. */
  expiresAt: number
}

export const issueSessionToken = async (
  claims: SessionClaims,
  secret: string,
  now = Date.now(),
): Promise<IssuedToken> => {
  const expiresAt = now + LIMITS.ownerSessionDays * 24 * 60 * 60 * 1000
  const token = await sign(
    {
      typ: 'session',
      sub: claims.memberId,
      fam: claims.familyId,
      iat: Math.floor(now / 1000),
      exp: Math.floor(expiresAt / 1000),
    },
    secret,
    ALGORITHM,
  )
  return { token, expiresAt }
}

/** Claims of a valid, unexpired session token, or `null` for anything else. */
export const verifySessionToken = async (
  token: string,
  secret: string,
): Promise<SessionClaims | null> => {
  try {
    const payload = await verify(token, secret, ALGORITHM)
    if (payload.typ !== 'session') return null
    if (typeof payload.sub !== 'string' || typeof payload.fam !== 'string') return null
    return { memberId: payload.sub, familyId: payload.fam }
  } catch {
    return null
  }
}

/** Invite token carried in the QR code. Reusable by any number of devices until it expires. */
export const issueInviteToken = async (
  familyId: string,
  secret: string,
  now = Date.now(),
): Promise<IssuedToken> => {
  const expiresAt = now + LIMITS.inviteTokenTtlMinutes * 60 * 1000
  const token = await sign(
    {
      typ: 'invite',
      fam: familyId,
      iat: Math.floor(now / 1000),
      exp: Math.floor(expiresAt / 1000),
    },
    secret,
    ALGORITHM,
  )
  return { token, expiresAt }
}

export type InviteVerification =
  | { valid: true; familyId: string }
  | { valid: false; reason: 'expired' | 'invalid' }

/** Expiry is told apart from other failures so the app can say "the QR code has expired". */
export const verifyInviteToken = async (
  token: string,
  secret: string,
): Promise<InviteVerification> => {
  try {
    const payload = await verify(token, secret, ALGORITHM)
    if (payload.typ !== 'invite' || typeof payload.fam !== 'string') {
      return { valid: false, reason: 'invalid' }
    }
    return { valid: true, familyId: payload.fam }
  } catch (error) {
    return { valid: false, reason: error instanceof JwtTokenExpired ? 'expired' : 'invalid' }
  }
}

export const isMemberKey = (credential: string): boolean => credential.startsWith(MEMBER_KEY_PREFIX)

/** A new member key (the "key file"): 256 random bits, base64url, with a recognizable prefix. */
export const generateMemberKey = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const base64 = btoa(String.fromCharCode(...bytes))
  return MEMBER_KEY_PREFIX + base64.replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

/**
 * SHA-256 (hex) of a member key — what `members.key_hash` stores. A fast hash is enough: the key
 * is 256 random bits, not a guessable password.
 */
export const hashMemberKey = async (key: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
