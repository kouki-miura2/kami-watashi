import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export type SignedInAs = 'owner' | 'member'

/**
 * Who this browser last signed in as, for when the API can't be asked at startup (offline,
 * `loadSignIn`). Not a credential: that is the API's HttpOnly cookie, which this app never sees.
 */
const STORAGE_KEY = 'kami-watashi.signed-in-as'

// Storage can be missing or refuse access (private browsing, Node in tests): the hint is optional.
const loadSignedInAs = (): SignedInAs | null => {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'owner' || value === 'member' ? value : null
  } catch {
    return null
  }
}
const saveSignedInAs = (value: SignedInAs | null): void => {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, value)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to do: the hint is optional.
  }
}

/**
 * Whether this browser is signed in, and as the owner or an invited member — as the API last
 * answered (`loadSignIn` / the launch query in `useLaunchQuery.ts`, sign-in, leaving).
 */
export const useAuthStore = defineStore('auth', () => {
  const signedInAs = ref<SignedInAs | null>(null)

  const isSignedIn = computed(() => signedInAs.value !== null)
  const isOwner = computed(() => signedInAs.value === 'owner')
  const isMember = computed(() => signedInAs.value === 'member')

  /** After the API set the credential cookie (sign-in, joining) or confirmed it (launch). */
  const signIn = (as: SignedInAs) => {
    signedInAs.value = as
    saveSignedInAs(as)
  }

  /** After the API rejected or cleared the credential cookie. */
  const signOut = () => {
    signedInAs.value = null
    saveSignedInAs(null)
  }

  /** When the API couldn't be asked: go by the last sign-in (the launch query asks again later). */
  const resumeLastSignIn = () => {
    signedInAs.value = loadSignedInAs()
  }

  return { isSignedIn, isOwner, isMember, signIn, signOut, resumeLastSignIn }
})
