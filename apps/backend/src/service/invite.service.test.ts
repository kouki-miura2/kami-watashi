import { LIMITS } from 'utils'
import { expect, test, vi } from 'vite-plus/test'

import { UniqueConstraintError } from '../dao/errors.ts'
import type { Member, MemberRepository } from '../repository/member.repository.ts'
import { fakeMemberRepository, ownerUser } from '../testing.ts'
import { createInviteService } from './invite.service.ts'
import { hashMemberKey, issueInviteToken, isMemberKey, verifyInviteToken } from './token.ts'

const secret = 'test-secret'

const member = (id: string, name: string): Member => ({
  id,
  familyId: 'f1',
  name,
  isOwner: id === 'owner',
  termsVersion: 'v1',
})

const owner = member('owner', '一郎')
const fullFamily = Array.from({ length: LIMITS.familyMembers }, (_, index) =>
  member(`m${index}`, `name${index}`),
)

const createService = (members: Member[] = [owner], overrides: Partial<MemberRepository> = {}) => {
  const repository = {
    listByFamily: vi.fn<MemberRepository['listByFamily']>(async (familyId) =>
      familyId === 'f1' ? members : [],
    ),
    createInvited: vi.fn<MemberRepository['createInvited']>(async () => true),
  }
  const service = createInviteService({
    memberRepository: fakeMemberRepository({ ...repository, ...overrides }),
    sessionSecret: secret,
    termsVersion: 'v1',
  })
  return { service, repository }
}

const inviteFor = async (familyId = 'f1') => (await issueInviteToken(familyId, secret)).token

test('createInvite issues an invite token for the caller family', async () => {
  const { service } = createService()

  const { inviteToken, expiresAt } = await service.createInvite(ownerUser)

  expect(await verifyInviteToken(inviteToken, secret)).toEqual({ valid: true, familyId: 'f1' })
  expect(expiresAt).toBeGreaterThan(Date.now())
})

test('createInvite refuses when the family is full', async () => {
  const { service } = createService(fullFamily)

  await expect(service.createInvite(ownerUser)).rejects.toMatchObject({ code: 'member_limit' })
})

test('redeem creates the member with the hash of the returned key', async () => {
  const { service, repository } = createService()

  const { memberKey } = await service.redeem({
    inviteToken: await inviteFor(),
    name: '二郎',
    termsVersion: 'v1',
  })

  expect(isMemberKey(memberKey)).toBe(true)
  expect(repository.createInvited).toHaveBeenCalledWith({
    id: expect.any(String),
    familyId: 'f1',
    name: '二郎',
    keyHash: await hashMemberKey(memberKey),
    termsVersion: 'v1',
    now: expect.any(Number),
    maxMembers: LIMITS.familyMembers,
  })
})

test('redeem tells an expired invite from an invalid one', async () => {
  const { service } = createService()
  const expired = (await issueInviteToken('f1', secret, Date.now() - 24 * 60 * 60 * 1000)).token

  await expect(
    service.redeem({ inviteToken: expired, name: '二郎', termsVersion: 'v1' }),
  ).rejects.toMatchObject({ code: 'invite_expired' })
  await expect(
    service.redeem({ inviteToken: 'garbage', name: '二郎', termsVersion: 'v1' }),
  ).rejects.toMatchObject({ code: 'invalid_invite' })
})

test('redeem refuses an invite to a family that no longer exists', async () => {
  const { service } = createService()

  await expect(
    service.redeem({ inviteToken: await inviteFor('deleted'), name: '二郎', termsVersion: 'v1' }),
  ).rejects.toMatchObject({ code: 'invalid_invite' })
})

test('redeem refuses when the family is full, including a lost race', async () => {
  await expect(
    createService(fullFamily).service.redeem({
      inviteToken: await inviteFor(),
      name: '二郎',
      termsVersion: 'v1',
    }),
  ).rejects.toMatchObject({ code: 'member_limit' })

  const { service } = createService([owner], { createInvited: async () => false })
  await expect(
    service.redeem({ inviteToken: await inviteFor(), name: '二郎', termsVersion: 'v1' }),
  ).rejects.toMatchObject({ code: 'member_limit' })
})

test('redeem refuses a name already used in the family, including a lost race', async () => {
  const { service, repository } = createService()
  await expect(
    service.redeem({ inviteToken: await inviteFor(), name: '一郎', termsVersion: 'v1' }),
  ).rejects.toMatchObject({ code: 'name_taken' })
  expect(repository.createInvited).not.toHaveBeenCalled()

  const racing = createService([owner], {
    createInvited: async () => {
      throw new UniqueConstraintError('name')
    },
  })
  await expect(
    racing.service.redeem({ inviteToken: await inviteFor(), name: '二郎', termsVersion: 'v1' }),
  ).rejects.toMatchObject({ code: 'name_taken' })
})

test('redeem refuses outdated terms', async () => {
  const { service } = createService()

  await expect(
    service.redeem({ inviteToken: await inviteFor(), name: '二郎', termsVersion: 'v0' }),
  ).rejects.toMatchObject({ code: 'invalid_terms_version' })
})
