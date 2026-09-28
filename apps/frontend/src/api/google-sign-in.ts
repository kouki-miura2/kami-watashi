import { Capacitor } from '@capacitor/core'
import { SocialLogin } from '@capgo/capacitor-social-login'

import { isCancellation } from '../lib/cancellation.ts'

/**
 * OAuth client ids (Google Cloud Console). The web client id is also what Android signs in with
 * (Credential Manager); iOS needs its own. The API accepts all of them as the ID token's `aud`
 * (`GOOGLE_CLIENT_IDS` in `apps/backend-worker/wrangler.jsonc`).
 */
const webClientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID as string | undefined
const iOSClientId = import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID as string | undefined

let initialized: Promise<void> | undefined

/**
 * Google sign-in on the device, yielding the ID token that `POST /auth/google` verifies.
 * Unavailable (the button is disabled) until this platform's client ids are configured; local
 * development signs in through `/dev/login` instead.
 */
export const googleSignIn = {
  available: Boolean(webClientId) && (Capacitor.getPlatform() !== 'ios' || Boolean(iOSClientId)),

  /** The ID token, or `null` when the user backs out of the Google sheet. */
  getIdToken: async (): Promise<string | null> => {
    initialized ??= SocialLogin.initialize({
      google: { webClientId, iOSClientId, iOSServerClientId: webClientId, mode: 'online' },
    })
    await initialized
    try {
      const { result } = await SocialLogin.login({
        provider: 'google',
        options: { scopes: ['profile'] },
      })
      const idToken = 'idToken' in result ? result.idToken : null
      if (!idToken) throw new Error('Google sign-in returned no ID token')
      return idToken
    } catch (error) {
      if (isCancellation(error)) return null
      throw error
    }
  },
}
