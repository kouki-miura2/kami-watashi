import { expect, test, vi } from 'vite-plus/test'

import type { FamilyDao } from '../dao/family.interface.ts'
import { createFamilyRepository } from './family.repository.ts'

const createFakeDao = () => ({
  createWithOwner: vi.fn<FamilyDao['createWithOwner']>(async () => {}),
  touch: vi.fn<FamilyDao['touch']>(async () => {}),
  listInactive: vi.fn<FamilyDao['listInactive']>(async () => ['f9']),
  delete: vi.fn<FamilyDao['delete']>(async () => {}),
})

test('flattens the new family and its owner into the DAO input', async () => {
  const dao = createFakeDao()

  await createFamilyRepository(dao).createWithOwner({
    familyId: 'f1',
    owner: { id: 'm1', name: '一郎', googleSub: 'google-1' },
    termsVersion: '2026-10-01',
    now: 123,
  })

  expect(dao.createWithOwner).toHaveBeenCalledWith({
    familyId: 'f1',
    ownerId: 'm1',
    ownerName: '一郎',
    googleSub: 'google-1',
    termsVersion: '2026-10-01',
    now: 123,
  })
})

test('passes touch through', async () => {
  const dao = createFakeDao()

  await createFamilyRepository(dao).touch('f1', 123)

  expect(dao.touch).toHaveBeenCalledWith('f1', 123)
})

test('passes listInactive and delete through', async () => {
  const dao = createFakeDao()
  const repository = createFamilyRepository(dao)

  expect(await repository.listInactive(500, 10)).toEqual(['f9'])
  expect(dao.listInactive).toHaveBeenCalledWith(500, 10)
  await repository.delete('f9')
  expect(dao.delete).toHaveBeenCalledWith('f9')
})
