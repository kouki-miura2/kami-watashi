import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, expect, test, vi } from 'vite-plus/test'

import { useAuthStore } from './auth.ts'

// Node has no `localStorage`: a Map-backed stand-in, fresh for every test.
beforeEach(() => {
  setActivePinia(createPinia())
  const items = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('starts signed out', () => {
  const auth = useAuthStore()

  expect(auth.isSignedIn).toBe(false)
  expect(auth.isOwner).toBe(false)
  expect(auth.isMember).toBe(false)
})

test('signIn records the owner or a member, and signOut forgets it', () => {
  const auth = useAuthStore()

  auth.signIn('owner')
  expect(auth.isOwner).toBe(true)
  expect(auth.isMember).toBe(false)

  auth.signIn('member')
  expect(auth.isMember).toBe(true)
  expect(auth.isOwner).toBe(false)

  auth.signOut()
  expect(auth.isSignedIn).toBe(false)
})

test('resumeLastSignIn goes by what this browser last signed in as', () => {
  useAuthStore().signIn('member')
  setActivePinia(createPinia())
  const auth = useAuthStore()

  auth.resumeLastSignIn()

  expect(auth.isMember).toBe(true)
})

test('resumeLastSignIn stays signed out after signing out', () => {
  useAuthStore().signIn('owner')
  useAuthStore().signOut()
  setActivePinia(createPinia())
  const auth = useAuthStore()

  auth.resumeLastSignIn()

  expect(auth.isSignedIn).toBe(false)
})

test('works without storage (private browsing)', () => {
  vi.stubGlobal('localStorage', undefined)
  const auth = useAuthStore()

  auth.signIn('owner')
  expect(auth.isOwner).toBe(true)
  auth.resumeLastSignIn()
  expect(auth.isSignedIn).toBe(false)
})
