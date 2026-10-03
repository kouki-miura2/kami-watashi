import { afterEach, beforeEach, expect, test, vi } from 'vite-plus/test'

import { UniqueConstraintError } from '../dao/errors.ts'
import type { AuthenticatedUser } from '../repository/auth-guard.interface.ts'
import type { Member, MemberRepository } from '../repository/member.repository.ts'
import { fakeMemberRepository } from '../testing.ts'
import { createMemberService } from './member.service.ts'

const now = Date.UTC(2026, 8, 28)

const member = (id: string, name: string, isOwner = false): Member => ({
  id,
  familyId: 'f1',
  name,
  isOwner,
  termsVersion: 'v1',
})

const user: AuthenticatedUser = {
  id: 'm3',
  familyId: 'f1',
  name: 'あきこ',
  isOwner: false,
  termsVersion: 'v1',
  dataVersion: 0,
}

const family = [member('m2', 'たろう'), member('m3', 'あきこ'), member('m1', '一郎', true)]

const createService = (overrides: Partial<MemberRepository> = {}) => {
  const repository = {
    listByFamily: vi.fn<MemberRepository['listByFamily']>(async () => family),
    rename: vi.fn<MemberRepository['rename']>(async () => {}),
    agreeTerms: vi.fn<MemberRepository['agreeTerms']>(async () => {}),
    delete: vi.fn<MemberRepository['delete']>(async () => {}),
  }
  const service = createMemberService({
    memberRepository: fakeMemberRepository({ ...repository, ...overrides }),
    termsVersion: 'v2',
  })
  return { service, repository }
}

beforeEach(() => {
  vi.useFakeTimers({ now })
})

afterEach(() => {
  vi.useRealTimers()
})

test('lists the family of the caller with the owner first, then by name, and marks the caller', async () => {
  const { service, repository } = createService()

  expect(await service.listMembers(user)).toEqual([
    { id: 'm1', name: '一郎', isOwner: true, isMe: false },
    { id: 'm3', name: 'あきこ', isOwner: false, isMe: true },
    { id: 'm2', name: 'たろう', isOwner: false, isMe: false },
  ])
  expect(repository.listByFamily).toHaveBeenCalledWith('f1')
})

test('rename changes the display name and records the old and new names', async () => {
  const { service, repository } = createService()

  expect(await service.rename(user, 'あき')).toEqual({ id: 'm3', name: 'あき' })
  expect(repository.rename).toHaveBeenCalledWith(
    user,
    'あき',
    { memberName: 'あきこ', target: 'member', action: 'update', name: 'あきこ', newName: 'あき' },
    now,
  )
})

test('rename to the current name changes nothing', async () => {
  const { service, repository } = createService()

  await service.rename(user, 'あきこ')

  expect(repository.rename).not.toHaveBeenCalled()
})

test('rename refuses a name another member uses', async () => {
  const { service, repository } = createService()

  await expect(service.rename(user, '一郎')).rejects.toMatchObject({ code: 'name_taken' })
  expect(repository.rename).not.toHaveBeenCalled()
})

test('rename maps a lost race on the unique name to name_taken', async () => {
  const { service } = createService({
    rename: async () => {
      throw new UniqueConstraintError('name')
    },
  })

  await expect(service.rename(user, 'あき')).rejects.toMatchObject({ code: 'name_taken' })
})

test('agreeTerms records agreement to the current version only', async () => {
  const { service, repository } = createService()

  await service.agreeTerms(user, 'v2')
  expect(repository.agreeTerms).toHaveBeenCalledWith('m3', 'v2', now)

  await expect(service.agreeTerms(user, 'v1')).rejects.toMatchObject({
    code: 'invalid_terms_version',
  })
})

test('removeMember deletes an invited member of the family and records it', async () => {
  const { service, repository } = createService()
  const owner = { ...user, id: 'm1', name: '一郎', isOwner: true }

  await service.removeMember(owner, 'm2')

  expect(repository.delete).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'm2', familyId: 'f1' }),
    { memberName: '一郎', target: 'member', action: 'delete', name: 'たろう' },
    now,
  )
})

test('removeMember refuses the owner and answers not_found outside the family', async () => {
  const { service, repository } = createService()
  const owner = { ...user, id: 'm1', name: '一郎', isOwner: true }

  await expect(service.removeMember(owner, 'm1')).rejects.toMatchObject({ code: 'forbidden' })
  await expect(service.removeMember(owner, 'other')).rejects.toMatchObject({ code: 'not_found' })
  expect(repository.delete).not.toHaveBeenCalled()
})

test('leave deletes and records the calling invited member; the owner cannot leave', async () => {
  const { service, repository } = createService()

  await service.leave(user)
  expect(repository.delete).toHaveBeenCalledWith(
    user,
    { memberName: user.name, target: 'member', action: 'delete', name: user.name },
    now,
  )

  await expect(service.leave({ ...user, isOwner: true })).rejects.toMatchObject({
    code: 'forbidden',
  })
})
