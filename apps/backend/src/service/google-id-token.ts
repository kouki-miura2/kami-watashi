import { verifyWithJwks } from 'hono/jwt'
import type { HonoJsonWebKey } from 'hono/utils/jwt/jws'

const GOOGLE_JWKS_URI = 'https://www.googleapis.com/oauth2/v3/certs'
// Google issues ID tokens with either form of the issuer.
const GOOGLE_ISSUER = /^(https:\/\/)?accounts\.google\.com$/

export interface GoogleIdentity {
  /** Stable Google account id — stored as `members.google_sub`. */
  sub: string
  /** Google account display name; empty if the token doesn't carry one. */
  name: string
}

export interface GoogleIdTokenVerifier {
  /** The identity in a valid Google ID token issued to one of our clients, or `null`. */
  verify: (idToken: string) => Promise<GoogleIdentity | null>
}

export const createGoogleIdTokenVerifier = (deps: {
  /** OAuth client ids (iOS / Android / Web) accepted as the token's `aud`. */
  clientIds: string[]
  /** Fixed signing keys instead of Google's JWKS endpoint — for tests. */
  keys?: HonoJsonWebKey[]
}): GoogleIdTokenVerifier => ({
  verify: async (idToken) => {
    // Nothing configured means nothing can be valid; also avoids hono treating `aud: []` as "any".
    if (deps.clientIds.length === 0) return null
    try {
      const payload = await verifyWithJwks(idToken, {
        ...(deps.keys ? { keys: deps.keys } : { jwks_uri: GOOGLE_JWKS_URI }),
        allowedAlgorithms: ['RS256'],
        verification: { iss: GOOGLE_ISSUER, aud: deps.clientIds },
      })
      if (typeof payload.sub !== 'string' || !payload.sub) return null
      return { sub: payload.sub, name: typeof payload.name === 'string' ? payload.name : '' }
    } catch {
      return null
    }
  },
})
