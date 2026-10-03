import { expect, test } from 'vite-plus/test'

import { hashMemberKey, issueSessionToken } from '../service/token.ts'
import { fakeMemberRepository } from '../testing.ts'
import { createTokenAuthGuard } from './auth-guard.token.ts'
import type { MemberWithDataVersion } from './member.repository.ts'

const secret = 'test-secret'
const memberKey = 'mk_test-key'

const owner: MemberWithDataVersion = {
  id: 'owner',
  familyId: 'f1',
  name: '一郎',
  isOwner: true,
  termsVersion: 'v1',
  dataVersion: 3,
}
const invited: MemberWithDataVersion = {
  id: 'invited',
  familyId: 'f1',
  name: '二郎',
  isOwner: false,
  termsVersion: 'v1',
  dataVersion: 3,
}

const createGuard = async (members: MemberWithDataVersion[] = [owner, invited]) => {
  const invitedKeyHash = await hashMemberKey(memberKey)
  const repository = fakeMemberRepository({
    findById: async (id) => members.find((member) => member.id === id) ?? null,
    findByKeyHash: async (keyHash) =>
      keyHash === invitedKeyHash ? (members.find((member) => member === invited) ?? null) : null,
  })
  return createTokenAuthGuard({ sessionSecret: secret, memberRepository: repository })
}

const sessionFor = async (memberId: string, familyId = 'f1') =>
  (await issueSessionToken({ memberId, familyId }, secret)).token

test('authenticates an owner by session token', async () => {
  const guard = await createGuard()

  expect(await guard.authenticate(await sessionFor('owner'))).toEqual({
    id: 'owner',
    familyId: 'f1',
    name: '一郎',
    isOwner: true,
    termsVersion: 'v1',
    dataVersion: 3,
  })
})

test('authenticates an invited member by member key', async () => {
  const guard = await createGuard()

  expect(await guard.authenticate(memberKey)).toMatchObject({
    id: 'invited',
    isOwner: false,
  })
})

test('rejects an empty or malformed credential', async () => {
  const guard = await createGuard()

  expect(await guard.authenticate('')).toBeNull()
  expect(await guard.authenticate('not-a-token')).toBeNull()
})

test('rejects an unknown member key', async () => {
  const guard = await createGuard()

  expect(await guard.authenticate('mk_unknown')).toBeNull()
})

test('rejects a member key once the member has been deleted', async () => {
  const guard = await createGuard([owner])

  expect(await guard.authenticate(memberKey)).toBeNull()
})

test('rejects a session once the owner (or their family) has been deleted', async () => {
  const guard = await createGuard([invited])

  expect(await guard.authenticate(await sessionFor('owner'))).toBeNull()
})

test('rejects a session token for a non-owner or a mismatched family', async () => {
  const guard = await createGuard()

  expect(await guard.authenticate(await sessionFor('invited'))).toBeNull()
  expect(await guard.authenticate(await sessionFor('owner', 'other'))).toBeNull()
})

test('rejects a session token signed with another secret', async () => {
  const guard = await createGuard()
  const { token } = await issueSessionToken({ memberId: 'owner', familyId: 'f1' }, 'other')

  expect(await guard.authenticate(token)).toBeNull()
})
