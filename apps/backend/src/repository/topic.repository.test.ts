import { expect, test, vi } from 'vite-plus/test'

import type { TopicDao, TopicRecord } from '../dao/topic.interface.ts'
import { createTopicRepository } from './topic.repository.ts'

const soccer: TopicRecord = { id: 't1', family_id: 'f1', name: 'サッカー' }

const createDao = () =>
  ({
    listByFamily: async () => [soccer],
    findInFamily: async (_familyId: string, id: string) => (id === 't1' ? soccer : null),
    create: vi.fn<TopicDao['create']>(async () => {}),
    rename: vi.fn<TopicDao['rename']>(async () => {}),
    delete: vi.fn<TopicDao['delete']>(async () => {}),
  }) satisfies TopicDao

const history = { memberName: '一郎', target: 'topic' as const, action: 'create' as const }

test('maps rows to topics', async () => {
  const repository = createTopicRepository(createDao())

  expect(await repository.listByFamily('f1')).toEqual([
    { id: 't1', familyId: 'f1', name: 'サッカー' },
  ])
  expect(await repository.findInFamily('f1', 'missing')).toBeNull()
})

test('create, rename and delete write the history row of the topic family', async () => {
  const dao = createDao()
  const repository = createTopicRepository(dao)
  const topic = { id: 't1', familyId: 'f1', name: 'サッカー' }

  await repository.create(topic, history, 1)
  await repository.rename(topic, 'サッカークラブ', { ...history, action: 'update' }, 2)
  await repository.delete(topic, { ...history, action: 'delete' }, 3)

  expect(dao.create).toHaveBeenCalledWith(
    { id: 't1', family_id: 'f1', name: 'サッカー' },
    expect.objectContaining({ family_id: 'f1', action: 'create', created_at: 1 }),
  )
  expect(dao.rename).toHaveBeenCalledWith(
    't1',
    'サッカークラブ',
    expect.objectContaining({ action: 'update', created_at: 2 }),
  )
  expect(dao.delete).toHaveBeenCalledWith(
    't1',
    expect.objectContaining({ action: 'delete', created_at: 3 }),
  )
})
