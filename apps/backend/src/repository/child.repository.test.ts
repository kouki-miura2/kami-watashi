import { expect, test, vi } from 'vite-plus/test'

import type { ChildDao, ChildRecord } from '../dao/child.interface.ts'
import { createChildRepository } from './child.repository.ts'

const hanako: ChildRecord = { id: 'c1', family_id: 'f1', name: 'はなこ', last_print_seq: 3 }

const createDao = () =>
  ({
    listByFamily: async () => [hanako],
    findInFamily: async (_familyId: string, id: string) => (id === 'c1' ? hanako : null),
    countPrintsSince: async () => [
      { child_id: null, count: 2 },
      { child_id: 'c1', count: 1 },
    ],
    countMiteneRequested: async () => [{ child_id: 'c1', count: 4 }],
    countPrints: async () => 7,
    listImages: async () => [{ print_id: 'p1', image_id: 'i1' }],
    create: vi.fn<ChildDao['create']>(async () => {}),
    rename: vi.fn<ChildDao['rename']>(async () => {}),
    delete: vi.fn<ChildDao['delete']>(async () => {}),
  }) satisfies ChildDao

const history = { memberName: '一郎', target: 'child' as const, action: 'create' as const }

test('maps rows to children without the sequence counter', async () => {
  const repository = createChildRepository(createDao())

  expect(await repository.listByFamily('f1')).toEqual([
    { id: 'c1', familyId: 'f1', name: 'はなこ' },
  ])
  expect(await repository.findInFamily('f1', 'missing')).toBeNull()
})

test('maps slot counts and image refs', async () => {
  const repository = createChildRepository(createDao())

  expect(await repository.countPrintsSince('f1', 0)).toEqual([
    { childId: null, count: 2 },
    { childId: 'c1', count: 1 },
  ])
  expect(await repository.countMiteneRequested('m1')).toEqual([{ childId: 'c1', count: 4 }])
  expect(await repository.listImages('c1')).toEqual([{ printId: 'p1', imageId: 'i1' }])
})

test('create inserts a row with a zero sequence counter and the history row', async () => {
  const dao = createDao()

  await createChildRepository(dao).create(
    { id: 'c2', familyId: 'f1', name: 'たろう' },
    { ...history, name: 'たろう' },
    5,
  )

  expect(dao.create).toHaveBeenCalledWith(
    { id: 'c2', family_id: 'f1', name: 'たろう', last_print_seq: 0 },
    expect.objectContaining({ family_id: 'f1', target: 'child', name: 'たろう', created_at: 5 }),
  )
})

test('rename and delete pass the history row of the child family', async () => {
  const dao = createDao()
  const repository = createChildRepository(dao)
  const child = { id: 'c1', familyId: 'f1', name: 'はなこ' }

  await repository.rename(child, 'かなこ', { ...history, action: 'update' }, 6)
  await repository.delete(child, { ...history, action: 'delete' }, 7)

  expect(dao.rename).toHaveBeenCalledWith(
    'c1',
    'かなこ',
    expect.objectContaining({ family_id: 'f1', action: 'update', created_at: 6 }),
  )
  expect(dao.delete).toHaveBeenCalledWith(
    'c1',
    expect.objectContaining({ family_id: 'f1', action: 'delete', created_at: 7 }),
  )
})
