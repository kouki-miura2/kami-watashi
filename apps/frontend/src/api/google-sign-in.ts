/**
 * The web OAuth client id (Google Cloud Console), with the web app's origin among its authorized
 * JavaScript origins. The API accepts it as the ID token's `aud` (`GOOGLE_CLIENT_IDS`).
 */
const clientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID as string | undefined

/** The part of Google Identity Services (`https://accounts.google.com/gsi/client`) used here. */
interface GoogleIdentity {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string
        callback: (response: { credential: string }) => void
      }) => void
      renderButton: (parent: HTMLElement, options: Record<string, string | number>) => void
    }
  }
}

let loaded: Promise<GoogleIdentity> | undefined

const loadGoogleIdentity = (): Promise<GoogleIdentity> =>
  (loaded ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = () => resolve((window as unknown as { google: GoogleIdentity }).google)
    script.onerror = () => {
      loaded = undefined
      reject(new Error('Could not load Google sign-in'))
    }
    document.head.append(script)
  }))

/**
 * Google sign-in, yielding the ID token that `POST /auth/google` verifies. Only Google's own button
 * hands out an ID token on the web, so this renders it. Unavailable (the caller shows a disabled
 * button instead) until `VITE_GOOGLE_WEB_CLIENT_ID` is set; local development can sign in through
 * `/dev/login` instead.
 */
export const googleSignIn = {
  available: Boolean(clientId),

  /** Renders Google's button into `parent`; `onIdToken` gets the ID token each time it signs someone in. */
  renderButton: async (parent: HTMLElement, onIdToken: (idToken: string) => void) => {
    const google = await loadGoogleIdentity()
    google.accounts.id.initialize({
      client_id: clientId!,
      callback: ({ credential }) => onIdToken(credential),
    })
    // As close to the design's main button as Google allows (at most 400px wide).
    google.accounts.id.renderButton(parent, {
      theme: 'filled_black',
      shape: 'pill',
      size: 'large',
      text: 'signin_with',
      locale: 'ja',
      width: Math.min(parent.clientWidth, 400),
    })
  },
}
