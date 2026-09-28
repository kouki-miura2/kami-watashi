import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, expect, test, vi } from 'vite-plus/test'

import { credentialStorage } from '../api/credential-storage.ts'
import { useAuthStore } from './auth.ts'

vi.mock('../api/credential-storage.ts', () => ({
  credentialStorage: { load: vi.fn(), save: vi.fn(), clear: vi.fn() },
}))

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

test('starts signed out', () => {
  const auth = useAuthStore()

  expect(auth.isSignedIn).toBe(false)
  expect(auth.isOwner).toBe(false)
  expect(auth.isMember).toBe(false)
})

test('restore loads the saved credential', async () => {
  vi.mocked(credentialStorage.load).mockResolvedValue('session-token')
  const auth = useAuthStore()

  await auth.restore()

  expect(auth.credential).toBe('session-token')
  expect(auth.isSignedIn).toBe(true)
})

test('an owner session token makes the device an owner', async () => {
  const auth = useAuthStore()

  await auth.signIn('eyJhbGciOiJIUzI1NiJ9.payload.signature')

  expect(auth.isOwner).toBe(true)
  expect(auth.isMember).toBe(false)
})

test('an invited member key makes the device a member', async () => {
  const auth = useAuthStore()

  await auth.signIn('mk_secret')

  expect(auth.isMember).toBe(true)
  expect(auth.isOwner).toBe(false)
})

test('signIn saves the credential and signOut clears it', async () => {
  const auth = useAuthStore()

  await auth.signIn('mk_secret')
  expect(credentialStorage.save).toHaveBeenCalledWith('mk_secret')

  await auth.signOut()
  expect(credentialStorage.clear).toHaveBeenCalled()
  expect(auth.isSignedIn).toBe(false)
})
