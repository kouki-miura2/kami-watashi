import { expect, test, vi } from 'vite-plus/test'

import type { PrintDao, PrintListRecord, PrintRecord } from '../dao/print.interface.ts'
import { createPrintRepository } from './print.repository.ts'

const record: PrintRecord = {
  id: 'p1',
  family_id: 'f1',
  child_id: 'c1',
  seq: 3,
  title: '運動会',
  received_on: '2026-09-25',
  due_on: null,
  response_status: 'todo',
  created_at: 100,
}

const listRecord: PrintListRecord = {
  ...record,
  is_read: 1,
  mitene_status: 'requested',
  mitene_from_name: '二郎',
  topic_ids: '["t1","t2"]',
  image_count: 2,
  cover_image_id: 'i1',
}

const createDao = () =>
  ({
    list: async () => [listRecord],
    findInFamily: async () => record,
    listTopicIds: async () => ['t1'],
    listImages: async () => [{ id: 'i1', print_id: 'p1', page: 1, size: 10 }],
    listMiteneStates: async () => [
      {
        member_id: 'm2',
        member_name: '二郎',
        mitene_status: 'seen' as const,
        mitene_from: 'm1',
        from_name: '一郎',
      },
    ],
    markViewed: vi.fn<PrintDao['markViewed']>(async () => {}),
    requestMitene: vi.fn<PrintDao['requestMitene']>(async () => {}),
    storageUsed: async () => 42,
    listCreatedSince: async () => [{ child_id: null, created_at: 5 }],
    findImageInFamily: async () => ({ id: 'i1', print_id: 'p1', page: 1, size: 10 }),
    create: vi.fn<PrintDao['create']>(async () => 4),
    update: vi.fn<PrintDao['update']>(async () => 5),
    replaceImages: vi.fn<PrintDao['replaceImages']>(async () => {}),
    delete: vi.fn<PrintDao['delete']>(async () => {}),
    countCreatedBy: async () => 7,
    imageBytesCreatedBy: async () => 700,
    listImagesCreatedBy: async () => [{ print_id: 'p1', image_id: 'i1' }],
    deleteCreatedBy: vi.fn<PrintDao['deleteCreatedBy']>(async () => {}),
  }) satisfies PrintDao

const print = {
  id: 'p1',
  familyId: 'f1',
  childId: 'c1',
  seq: 3,
  title: '運動会',
  receivedOn: '2026-09-25',
  dueOn: null,
  responseStatus: 'todo' as const,
  createdAt: 100,
}

const history = { memberName: '一郎', target: 'print' as const, action: 'update' as const }

test('maps list rows, parsing topic ids and the read flag', async () => {
  const [item] = await createPrintRepository(createDao()).list({
    familyId: 'f1',
    childId: 'c1',
    memberId: 'm1',
    sort: 'created',
    today: '2026-09-28',
    topicIds: [],
  })

  expect(item).toEqual({
    ...print,
    topicIds: ['t1', 't2'],
    imageCount: 2,
    coverImageId: 'i1',
    isRead: true,
    miteneStatus: 'requested',
    miteneFromName: '二郎',
  })
})

test('maps a print, its images, mitene states and an image ref', async () => {
  const repository = createPrintRepository(createDao())

  expect(await repository.findInFamily('f1', 'p1')).toEqual(print)
  expect(await repository.listImages('p1')).toEqual([{ id: 'i1', page: 1, size: 10 }])
  expect(await repository.listMiteneStates('p1')).toEqual([
    {
      memberId: 'm2',
      memberName: '二郎',
      status: 'seen',
      fromMemberId: 'm1',
      fromMemberName: '一郎',
    },
  ])
  expect(await repository.findImageInFamily('f1', 'i1')).toEqual({ printId: 'p1', imageId: 'i1' })
  expect(await repository.listCreatedSince('f1', 0)).toEqual([{ childId: null, createdAt: 5 }])
  expect(await repository.listImagesCreatedBy('f1', 0)).toEqual([{ printId: 'p1', imageId: 'i1' }])
})

test('create maps the print, its images and history to rows', async () => {
  const dao = createDao()
  const { seq: _, ...unsequenced } = print

  expect(
    await createPrintRepository(dao).create(
      {
        print: unsequenced,
        images: [{ id: 'i1', page: 1, size: 10 }],
        topicIds: ['t1'],
        creatorId: 'm1',
        history: { ...history, action: 'create' },
      },
      200,
    ),
  ).toBe(4)
  expect(dao.create).toHaveBeenCalledWith({
    print: {
      id: 'p1',
      family_id: 'f1',
      child_id: 'c1',
      title: '運動会',
      received_on: '2026-09-25',
      due_on: null,
      response_status: 'todo',
      created_at: 100,
    },
    images: [{ id: 'i1', print_id: 'p1', page: 1, size: 10 }],
    topicIds: ['t1'],
    creatorId: 'm1',
    history: expect.objectContaining({ action: 'create', print_seq: null, created_at: 200 }),
  })
})

test('update maps only the given changes, keeping explicit nulls', async () => {
  const dao = createDao()

  await createPrintRepository(dao).update(
    {
      print: { id: 'p1', familyId: 'f1' },
      changes: { title: null, responseStatus: 'done' },
      move: { childId: null },
      histories: [history],
    },
    300,
  )

  expect(dao.update).toHaveBeenCalledWith({
    printId: 'p1',
    familyId: 'f1',
    changes: { title: null, response_status: 'done' },
    topicIds: undefined,
    move: { childId: null },
    histories: [expect.objectContaining({ family_id: 'f1', created_at: 300 })],
  })
})
