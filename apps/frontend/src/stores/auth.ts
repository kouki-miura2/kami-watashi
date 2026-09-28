import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { credentialStorage } from '../api/credential-storage.ts'

/** Invited members' device keys start with this; owners' session tokens don't. */
const MEMBER_KEY_PREFIX = 'mk_'

/** The API credential this device signs in with, kept in memory and in `credentialStorage`. */
export const useAuthStore = defineStore('auth', () => {
  const credential = ref<string | null>(null)

  const isSignedIn = computed(() => credential.value !== null)
  const isMember = computed(() => credential.value?.startsWith(MEMBER_KEY_PREFIX) ?? false)
  const isOwner = computed(() => isSignedIn.value && !isMember.value)

  /** Loads the saved credential. Call once at startup, before the router's first navigation. */
  const restore = async () => {
    credential.value = await credentialStorage.load()
  }

  const signIn = async (next: string) => {
    await credentialStorage.save(next)
    credential.value = next
  }

  const signOut = async () => {
    await credentialStorage.clear()
    credential.value = null
  }

  return { credential, isSignedIn, isMember, isOwner, restore, signIn, signOut }
})
