import { expect, test, vi } from 'vite-plus/test'

import type { MemberDao, MemberRecord } from '../dao/member.interface.ts'
import { createMemberRepository } from './member.repository.ts'

const owner: MemberRecord = {
  id: 'm1',
  family_id: 'f1',
  name: '一郎',
  google_sub: 'google-1',
  key_hash: null,
  terms_version: '2026-10-01',
  terms_agreed_at: 1,
}
const invited: MemberRecord = {
  id: 'm2',
  family_id: 'f1',
  name: '二郎',
  google_sub: null,
  key_hash: 'hash-2',
  terms_version: null,
  terms_agreed_at: null,
}

const dao = {
  findById: async (id: string) => [owner, invited].find((record) => record.id === id) ?? null,
  findByKeyHash: async (keyHash: string) => (keyHash === 'hash-2' ? invited : null),
  findByGoogleSub: async (googleSub: string) => (googleSub === 'google-1' ? owner : null),
  listByFamily: async () => [owner, invited],
  createInvited: vi.fn<MemberDao['createInvited']>(async () => true),
  rename: vi.fn<MemberDao['rename']>(async () => {}),
  agreeTerms: vi.fn<MemberDao['agreeTerms']>(async () => {}),
  delete: vi.fn<MemberDao['delete']>(async () => {}),
} satisfies MemberDao
const repository = createMemberRepository(dao)

test('maps a row with google_sub to an owner', async () => {
  expect(await repository.findById('m1')).toEqual({
    id: 'm1',
    familyId: 'f1',
    name: '一郎',
    isOwner: true,
    termsVersion: '2026-10-01',
  })
})

test('maps a row with key_hash to an invited member', async () => {
  expect(await repository.findByKeyHash('hash-2')).toMatchObject({ id: 'm2', isOwner: false })
})

test('returns null when the DAO finds nothing', async () => {
  expect(await repository.findById('missing')).toBeNull()
  expect(await repository.findByGoogleSub('missing')).toBeNull()
})

test('lists the members of a family', async () => {
  expect((await repository.listByFamily('f1')).map((member) => member.id)).toEqual(['m1', 'm2'])
})

test('rename passes the history entry as a row of the member family', async () => {
  await repository.rename(
    { id: 'm2', familyId: 'f1' },
    '二朗',
    { memberName: '二郎', target: 'member', action: 'update', name: '二郎', newName: '二朗' },
    123,
  )

  expect(dao.rename).toHaveBeenCalledWith(
    'm2',
    '二朗',
    expect.objectContaining({
      family_id: 'f1',
      member_name: '二郎',
      target: 'member',
      action: 'update',
      name: '二郎',
      new_name: '二朗',
      created_at: 123,
    }),
  )
})

test('passes createInvited, agreeTerms and delete through', async () => {
  const input = {
    id: 'm4',
    familyId: 'f1',
    name: '四郎',
    keyHash: 'h',
    termsVersion: 'v1',
    now: 1,
    maxMembers: 3,
  }

  expect(await repository.createInvited(input)).toBe(true)
  expect(dao.createInvited).toHaveBeenCalledWith(input)

  await repository.agreeTerms('m2', 'v2', 5)
  expect(dao.agreeTerms).toHaveBeenCalledWith('m2', 'v2', 5)

  await repository.delete('m2')
  expect(dao.delete).toHaveBeenCalledWith('m2')
})
