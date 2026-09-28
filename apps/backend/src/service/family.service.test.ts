import { LIMITS } from 'utils'
import { afterEach, beforeEach, expect, test, vi } from 'vite-plus/test'

import type { FamilyRepository } from '../repository/family.repository.ts'
import type { ImageRepository } from '../repository/image.repository.ts'
import { invitedUser, ownerUser } from '../testing.ts'
import { MAX_FAMILIES_PER_RUN, createFamilyService } from './family.service.ts'

const now = Date.UTC(2026, 8, 28)

const createService = () => {
  const calls: string[] = []
  const familyRepository = {
    listInactive: vi.fn<FamilyRepository['listInactive']>(async () => ['old1', 'old2']),
    delete: vi.fn<FamilyRepository['delete']>(async (familyId) => {
      calls.push(`d1:${familyId}`)
    }),
  }
  const imageRepository = {
    deleteFamilyImages: vi.fn<ImageRepository['deleteFamilyImages']>(async (familyId) => {
      calls.push(`r2:${familyId}`)
    }),
  }
  const service = createFamilyService({
    familyRepository: familyRepository as unknown as FamilyRepository,
    imageRepository: imageRepository as unknown as ImageRepository,
  })
  return { service, familyRepository, imageRepository, calls }
}

beforeEach(() => {
  vi.useFakeTimers({ now })
  vi.spyOn(console, 'info').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

test('withdraw deletes the photos, then the family, then sweeps the photos again', async () => {
  const { service, calls } = createService()

  await service.withdraw(ownerUser)

  expect(calls).toEqual(['r2:f1', 'd1:f1', 'r2:f1'])
})

test('withdraw is refused to an invited member', async () => {
  const { service, calls } = createService()

  await expect(service.withdraw(invitedUser)).rejects.toMatchObject({ code: 'forbidden' })
  expect(calls).toEqual([])
})

test('withdraw leaves the family intact when deleting the photos fails first', async () => {
  const { service, familyRepository, imageRepository } = createService()
  imageRepository.deleteFamilyImages.mockRejectedValueOnce(new Error('R2 down'))

  await expect(service.withdraw(ownerUser)).rejects.toThrow('R2 down')
  expect(familyRepository.delete).not.toHaveBeenCalled()
})

test('withdraw still succeeds if only the final sweep fails, and logs it', async () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  const { service, familyRepository, imageRepository } = createService()
  imageRepository.deleteFamilyImages
    .mockResolvedValueOnce()
    .mockRejectedValueOnce(new Error('R2 down'))

  await expect(service.withdraw(ownerUser)).resolves.toBeUndefined()
  expect(familyRepository.delete).toHaveBeenCalledWith('f1')
  expect(error).toHaveBeenCalledTimes(1)
})

test('deleteInactive deletes families not launched for LIMITS.autoDeleteDays', async () => {
  const { service, familyRepository, calls } = createService()

  expect(await service.deleteInactive()).toEqual({ deleted: 2, failed: 0 })
  expect(familyRepository.listInactive).toHaveBeenCalledWith(
    now - LIMITS.autoDeleteDays * 24 * 60 * 60 * 1000,
    MAX_FAMILIES_PER_RUN,
  )
  expect(calls).toEqual(['r2:old1', 'd1:old1', 'r2:old1', 'r2:old2', 'd1:old2', 'r2:old2'])
})

test('deleteInactive keeps going past a family that fails', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const { service, familyRepository } = createService()
  familyRepository.delete.mockRejectedValueOnce(new Error('D1 down'))

  expect(await service.deleteInactive()).toEqual({ deleted: 1, failed: 1 })
  expect(familyRepository.delete).toHaveBeenCalledWith('old2')
})
