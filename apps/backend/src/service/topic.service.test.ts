import { afterEach, beforeEach, expect, test, vi } from 'vite-plus/test'

import { UniqueConstraintError } from '../dao/errors.ts'
import type { Topic, TopicRepository } from '../repository/topic.repository.ts'
import { invitedUser } from '../testing.ts'
import { createTopicService } from './topic.service.ts'

const now = Date.UTC(2026, 8, 28)

const soccer: Topic = { id: 't1', familyId: 'f1', name: 'サッカー' }
const game: Topic = { id: 't2', familyId: 'f1', name: '試合' }
const excursion: Topic = { id: 't3', familyId: 'f1', name: 'えんそく' }

const createService = (overrides: Partial<TopicRepository> = {}) => {
  const topicRepository = {
    listByFamily: vi.fn<TopicRepository['listByFamily']>(async () => [soccer, game, excursion]),
    listWithPrintCounts: vi.fn<TopicRepository['listWithPrintCounts']>(async () => [
      { ...soccer, printCount: 2 },
      { ...game, printCount: 0 },
      { ...excursion, printCount: 5 },
    ]),
    findInFamily: vi.fn<TopicRepository['findInFamily']>(
      async (_familyId, id) => [soccer, game, excursion].find((topic) => topic.id === id) ?? null,
    ),
    create: vi.fn<TopicRepository['create']>(async () => {}),
    rename: vi.fn<TopicRepository['rename']>(async () => {}),
    delete: vi.fn<TopicRepository['delete']>(async () => {}),
    ...overrides,
  }
  return { service: createTopicService({ topicRepository }), topicRepository }
}

beforeEach(() => {
  vi.useFakeTimers({ now })
})

afterEach(() => {
  vi.useRealTimers()
})

test('list sorts topics by name, with their print counts', async () => {
  const { service, topicRepository } = createService()

  expect(await service.list(invitedUser)).toEqual([
    { id: 't3', name: 'えんそく', printCount: 5 },
    { id: 't1', name: 'サッカー', printCount: 2 },
    { id: 't2', name: '試合', printCount: 0 },
  ])
  expect(topicRepository.listWithPrintCounts).toHaveBeenCalledWith('f1')
})

test('create adds the topic and records it', async () => {
  const { service, topicRepository } = createService()

  const created = await service.create(invitedUser, '遠足')

  expect(created).toEqual({ id: expect.any(String), name: '遠足' })
  expect(topicRepository.create).toHaveBeenCalledWith(
    { id: created.id, familyId: 'f1', name: '遠足' },
    { memberName: invitedUser.name, target: 'topic', action: 'create', name: '遠足' },
    now,
  )
})

test('create refuses a taken name, including a lost race', async () => {
  await expect(createService().service.create(invitedUser, '試合')).rejects.toMatchObject({
    code: 'name_taken',
  })

  const { service } = createService({
    create: async () => {
      throw new UniqueConstraintError('name')
    },
  })
  await expect(service.create(invitedUser, '遠足')).rejects.toMatchObject({ code: 'name_taken' })
})

test('rename records the old and new names', async () => {
  const { service, topicRepository } = createService()

  expect(await service.rename(invitedUser, 't1', 'サッカークラブ')).toEqual({
    id: 't1',
    name: 'サッカークラブ',
  })
  expect(topicRepository.rename).toHaveBeenCalledWith(
    soccer,
    'サッカークラブ',
    {
      memberName: invitedUser.name,
      target: 'topic',
      action: 'update',
      name: 'サッカー',
      newName: 'サッカークラブ',
    },
    now,
  )
})

test('rename to the same name changes nothing; to a taken name is refused', async () => {
  const { service, topicRepository } = createService()

  await service.rename(invitedUser, 't1', 'サッカー')
  await expect(service.rename(invitedUser, 't1', '試合')).rejects.toMatchObject({
    code: 'name_taken',
  })
  expect(topicRepository.rename).not.toHaveBeenCalled()
})

test('delete records the topic name', async () => {
  const { service, topicRepository } = createService()

  await service.delete(invitedUser, 't1')

  expect(topicRepository.delete).toHaveBeenCalledWith(
    soccer,
    { memberName: invitedUser.name, target: 'topic', action: 'delete', name: 'サッカー' },
    now,
  )
})

test('rename and delete answer not_found for a topic outside the family', async () => {
  const { service } = createService()

  await expect(service.rename(invitedUser, 'other', 'x')).rejects.toMatchObject({
    code: 'not_found',
  })
  await expect(service.delete(invitedUser, 'other')).rejects.toMatchObject({ code: 'not_found' })
})
