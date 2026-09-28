import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.kamiwatashi.app',
  appName: 'かみわたし',
  // `vp build` output. Copy it into the native projects with `vp run frontend#cap:sync`.
  webDir: 'dist',
  plugins: {
    // Only Google sign-in is used; leaving the other providers out keeps their SDKs out of the app.
    SocialLogin: {
      providers: { google: true, facebook: false, apple: false, twitter: false },
    },
  },
}

export default config
