import { LIMITS } from 'utils'
import { afterEach, beforeEach, expect, test, vi } from 'vite-plus/test'

import { UniqueConstraintError } from '../dao/errors.ts'
import type { Child, ChildRepository } from '../repository/child.repository.ts'
import type { ImageRepository } from '../repository/image.repository.ts'
import { invitedUser } from '../testing.ts'
import { COMMON_SLOT_NAME, createChildService } from './child.service.ts'

// Wednesday 2026-09-30 12:00 JST; the week started Monday 2026-09-28 00:00 JST.
const now = Date.UTC(2026, 8, 30, 3)
const weekStart = Date.UTC(2026, 8, 27, 15)

const hanako: Child = { id: 'c1', familyId: 'f1', name: 'はなこ' }
const taro: Child = { id: 'c2', familyId: 'f1', name: 'たろう' }

const createService = (overrides: Partial<ChildRepository> = {}) => {
  const childRepository = {
    listByFamily: vi.fn<ChildRepository['listByFamily']>(async () => [hanako, taro]),
    findInFamily: vi.fn<ChildRepository['findInFamily']>(
      async (_familyId, id) => [hanako, taro].find((child) => child.id === id) ?? null,
    ),
    countPrintsSince: vi.fn<ChildRepository['countPrintsSince']>(async () => [
      { childId: null, count: 2 },
      { childId: 'c2', count: 1 },
    ]),
    countMiteneRequested: vi.fn<ChildRepository['countMiteneRequested']>(async () => [
      { childId: 'c1', count: 3 },
    ]),
    countPrints: vi.fn<ChildRepository['countPrints']>(async () => 12),
    listImages: vi.fn<ChildRepository['listImages']>(async () => [
      { printId: 'p1', imageId: 'i1' },
    ]),
    create: vi.fn<ChildRepository['create']>(async () => {}),
    rename: vi.fn<ChildRepository['rename']>(async () => {}),
    delete: vi.fn<ChildRepository['delete']>(async () => {}),
    ...overrides,
  }
  const imageRepository = {
    putImages: vi.fn<ImageRepository['putImages']>(async () => {}),
    getImage: vi.fn<ImageRepository['getImage']>(async () => null),
    deleteImages: vi.fn<ImageRepository['deleteImages']>(async () => {}),
    deleteFamilyImages: vi.fn<ImageRepository['deleteFamilyImages']>(async () => {}),
  }
  const service = createChildService({ childRepository, imageRepository })
  return { service, childRepository, imageRepository }
}

beforeEach(() => {
  vi.useFakeTimers({ now })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

test('listSlots puts the family-common slot first and fills in this week and the badge', async () => {
  const { service, childRepository } = createService()

  expect(await service.listSlots(invitedUser)).toEqual([
    { id: null, name: COMMON_SLOT_NAME, weekCount: 2, miteneCount: 0 },
    { id: 'c1', name: 'はなこ', weekCount: 0, miteneCount: 3 },
    { id: 'c2', name: 'たろう', weekCount: 1, miteneCount: 0 },
  ])
  expect(childRepository.countPrintsSince).toHaveBeenCalledWith('f1', weekStart)
  expect(childRepository.countMiteneRequested).toHaveBeenCalledWith(invitedUser.id)
})

test('create adds the child and records it', async () => {
  const { service, childRepository } = createService()

  const created = await service.create(invitedUser, 'じろう')

  expect(created).toEqual({ id: expect.any(String), name: 'じろう' })
  expect(childRepository.create).toHaveBeenCalledWith(
    { id: created.id, familyId: 'f1', name: 'じろう' },
    { memberName: invitedUser.name, target: 'child', action: 'create', name: 'じろう' },
    now,
  )
})

test('create refuses a taken name and the reserved family-common name', async () => {
  const { service, childRepository } = createService()

  await expect(service.create(invitedUser, 'はなこ')).rejects.toMatchObject({ code: 'name_taken' })
  await expect(service.create(invitedUser, COMMON_SLOT_NAME)).rejects.toMatchObject({
    code: 'name_taken',
  })
  expect(childRepository.create).not.toHaveBeenCalled()
})

test('create refuses a child beyond the family limit', async () => {
  const children = Array.from({ length: LIMITS.familyChildren }, (_, index) => ({
    id: `c${index}`,
    familyId: 'f1',
    name: `こども${index}`,
  }))
  const { service, childRepository } = createService({ listByFamily: async () => children })

  await expect(service.create(invitedUser, 'じろう')).rejects.toMatchObject({
    code: 'child_limit',
  })
  expect(childRepository.create).not.toHaveBeenCalled()
})

test('create maps a lost race on the unique name to name_taken', async () => {
  const { service } = createService({
    create: async () => {
      throw new UniqueConstraintError('name')
    },
  })

  await expect(service.create(invitedUser, 'じろう')).rejects.toMatchObject({ code: 'name_taken' })
})

test('rename records the old and new names', async () => {
  const { service, childRepository } = createService()

  expect(await service.rename(invitedUser, 'c1', 'かなこ')).toEqual({ id: 'c1', name: 'かなこ' })
  expect(childRepository.rename).toHaveBeenCalledWith(
    hanako,
    'かなこ',
    {
      memberName: invitedUser.name,
      target: 'child',
      action: 'update',
      name: 'はなこ',
      newName: 'かなこ',
    },
    now,
  )
})

test('rename to the same name changes nothing; to a taken name is refused', async () => {
  const { service, childRepository } = createService()

  await service.rename(invitedUser, 'c1', 'はなこ')
  await expect(service.rename(invitedUser, 'c1', 'たろう')).rejects.toMatchObject({
    code: 'name_taken',
  })
  expect(childRepository.rename).not.toHaveBeenCalled()
})

test('rename and delete answer not_found for a child outside the family', async () => {
  const { service } = createService()

  await expect(service.rename(invitedUser, 'other', 'x')).rejects.toMatchObject({
    code: 'not_found',
  })
  await expect(service.delete(invitedUser, 'other')).rejects.toMatchObject({ code: 'not_found' })
})

test('delete records the print count, then deletes the photos', async () => {
  const { service, childRepository, imageRepository } = createService()

  await service.delete(invitedUser, 'c1')

  expect(childRepository.delete).toHaveBeenCalledWith(
    hanako,
    {
      memberName: invitedUser.name,
      target: 'child',
      action: 'delete',
      name: 'はなこ',
      details: { print_count: 12 },
    },
    now,
  )
  expect(imageRepository.deleteImages).toHaveBeenCalledWith('f1', [
    { printId: 'p1', imageId: 'i1' },
  ])
})

test('delete succeeds and logs when deleting the photos fails', async () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  const { service, imageRepository } = createService()
  imageRepository.deleteImages.mockRejectedValueOnce(new Error('R2 down'))

  await expect(service.delete(invitedUser, 'c1')).resolves.toBeUndefined()
  expect(error).toHaveBeenCalledTimes(1)
})
