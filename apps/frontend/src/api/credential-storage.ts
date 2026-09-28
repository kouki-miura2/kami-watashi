import { SecureStorage } from '@aparajita/capacitor-secure-storage'

const STORAGE_KEY = 'kami-watashi.credential'

/**
 * Where this device keeps its API credential (the owner's session token or an invited member's
 * key): the iOS Keychain / Android Keystore (spec "認証"). In the browser (development) the plugin
 * falls back to `localStorage`.
 */
export const credentialStorage = {
  load: async (): Promise<string | null> => SecureStorage.getItem(STORAGE_KEY),
  save: async (credential: string): Promise<void> => SecureStorage.setItem(STORAGE_KEY, credential),
  clear: async (): Promise<void> => SecureStorage.removeItem(STORAGE_KEY),
}
