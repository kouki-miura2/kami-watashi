import { afterEach, beforeEach, expect, test, vi } from 'vite-plus/test'

import { UniqueConstraintError } from '../dao/errors.ts'
import type { AuthenticatedUser } from '../repository/auth-guard.interface.ts'
import type { FamilyRepository } from '../repository/family.repository.ts'
import type { Member } from '../repository/member.repository.ts'
import { fakeMemberRepository } from '../testing.ts'
import { createAuthService } from './auth.service.ts'
import type { GoogleIdentity } from './google-id-token.ts'
import { verifySessionToken } from './token.ts'

const secret = 'test-secret'
const now = Date.UTC(2026, 8, 28)

const existingOwner: Member = {
  id: 'owner',
  familyId: 'f1',
  name: '一郎',
  isOwner: true,
  termsVersion: 'v1',
}

const identities: Record<string, GoogleIdentity> = {
  'token-existing': { sub: 'google-1', name: '山田 一郎' },
  'token-new': { sub: 'google-new', name: 'とてもとてもながいなまえのひとですがなにか' },
}

const createService = () => {
  const familyRepository = {
    createWithOwner: vi.fn<FamilyRepository['createWithOwner']>(async () => {}),
    touch: vi.fn<FamilyRepository['touch']>(async () => {}),
    listInactive: vi.fn<FamilyRepository['listInactive']>(async () => []),
    delete: vi.fn<FamilyRepository['delete']>(async () => {}),
  }
  const memberRepository = fakeMemberRepository({
    findByGoogleSub: async (googleSub) => (googleSub === 'google-1' ? existingOwner : null),
  })
  const service = createAuthService({
    familyRepository,
    memberRepository,
    googleIdTokenVerifier: { verify: async (idToken) => identities[idToken] ?? null },
    sessionSecret: secret,
    termsVersion: 'v2',
  })
  return { service, familyRepository }
}

const claimsOf = (sessionToken: string) => verifySessionToken(sessionToken, secret)

beforeEach(() => {
  vi.useFakeTimers({ now })
})

afterEach(() => {
  vi.useRealTimers()
})

test('googleLogin signs in a registered owner', async () => {
  const { service } = createService()

  const { sessionToken } = await service.googleLogin('token-existing')

  expect(await claimsOf(sessionToken)).toEqual({ memberId: 'owner', familyId: 'f1' })
})

test('googleLogin reports an unregistered account with the Google name cut to the limit', async () => {
  const { service } = createService()

  await expect(service.googleLogin('token-new')).rejects.toMatchObject({
    code: 'not_registered',
    details: { suggestedName: 'とてもとてもながいなまえのひとですがなに' },
  })
})

test('googleLogin rejects an invalid ID token', async () => {
  const { service } = createService()

  await expect(service.googleLogin('garbage')).rejects.toMatchObject({ code: 'unauthorized' })
})

test('register creates the family and owner with the current terms, then signs in', async () => {
  const { service, familyRepository } = createService()

  const { sessionToken } = await service.register({
    idToken: 'token-new',
    name: '三郎',
    termsVersion: 'v2',
  })

  const [input] = familyRepository.createWithOwner.mock.calls[0]
  expect(input).toMatchObject({
    owner: { name: '三郎', googleSub: 'google-new' },
    termsVersion: 'v2',
    now,
  })
  expect(await claimsOf(sessionToken)).toEqual({
    memberId: input.owner.id,
    familyId: input.familyId,
  })
})

test('register refuses an account that already owns a family', async () => {
  const { service, familyRepository } = createService()

  await expect(
    service.register({ idToken: 'token-existing', name: '一郎', termsVersion: 'v2' }),
  ).rejects.toMatchObject({ code: 'already_registered' })
  expect(familyRepository.createWithOwner).not.toHaveBeenCalled()
})

test('register maps a lost race on google_sub to already_registered', async () => {
  const { service, familyRepository } = createService()
  familyRepository.createWithOwner.mockRejectedValueOnce(new UniqueConstraintError('google_sub'))

  await expect(
    service.register({ idToken: 'token-new', name: '三郎', termsVersion: 'v2' }),
  ).rejects.toMatchObject({ code: 'already_registered' })
})

test('register refuses outdated terms and invalid ID tokens', async () => {
  const { service } = createService()

  await expect(
    service.register({ idToken: 'token-new', name: '三郎', termsVersion: 'v1' }),
  ).rejects.toMatchObject({ code: 'invalid_terms_version' })
  await expect(
    service.register({ idToken: 'garbage', name: '三郎', termsVersion: 'v2' }),
  ).rejects.toMatchObject({ code: 'unauthorized' })
})

test('devLogin signs in an existing owner without creating anything', async () => {
  const { service, familyRepository } = createService()

  const { sessionToken } = await service.devLogin({ googleSub: 'google-1', name: 'ignored' })

  expect(await claimsOf(sessionToken)).toEqual({ memberId: 'owner', familyId: 'f1' })
  expect(familyRepository.createWithOwner).not.toHaveBeenCalled()
})

test('devLogin creates a family for a new googleSub', async () => {
  const { service, familyRepository } = createService()

  await service.devLogin({ googleSub: 'google-dev', name: '三郎' })

  expect(familyRepository.createWithOwner).toHaveBeenCalledWith(
    expect.objectContaining({ owner: expect.objectContaining({ googleSub: 'google-dev' }) }),
  )
})

test('launch records the access and renews the owner session', async () => {
  const { service, familyRepository } = createService()
  const user: AuthenticatedUser = { ...existingOwner, termsVersion: 'v2' }

  const result = await service.launch(user)

  expect(familyRepository.touch).toHaveBeenCalledWith('f1', now)
  expect(result).toMatchObject({
    me: { id: 'owner', name: '一郎', isOwner: true },
    termsVersion: 'v2',
    termsAgreed: true,
  })
  expect(await claimsOf(result.session?.sessionToken ?? '')).toEqual({
    memberId: 'owner',
    familyId: 'f1',
  })
})

test('launch returns no session for an invited member and flags outdated terms', async () => {
  const { service } = createService()
  const user: AuthenticatedUser = {
    id: 'invited',
    familyId: 'f1',
    name: '二郎',
    isOwner: false,
    termsVersion: 'v1',
  }

  const result = await service.launch(user)

  expect(result.session).toBeNull()
  expect(result.termsAgreed).toBe(false)
})
