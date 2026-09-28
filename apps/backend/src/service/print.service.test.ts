import { LIMITS } from 'utils'
import { afterEach, beforeEach, expect, test, vi } from 'vite-plus/test'

import type { ChildRepository } from '../repository/child.repository.ts'
import type { ImageRepository } from '../repository/image.repository.ts'
import type { Print, PrintRepository } from '../repository/print.repository.ts'
import type { TopicRepository } from '../repository/topic.repository.ts'
import { invitedUser } from '../testing.ts'
import { createPrintService } from './print.service.ts'

// 2026-09-28 12:00 JST.
const now = Date.UTC(2026, 8, 28, 3)

const jpeg = (size = 10) => {
  const bytes = new Uint8Array(size)
  bytes.set([0xff, 0xd8, 0xff, 0xe0])
  return new Blob([bytes], { type: 'image/jpeg' })
}
const png = () => new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/jpeg' })

const print: Print = {
  id: 'p1',
  familyId: 'f1',
  childId: 'c1',
  seq: 1,
  title: '遠足',
  receivedOn: null,
  dueOn: '2026-10-03',
  responseStatus: 'none',
  createdAt: 100,
}

const createService = (overrides: Partial<PrintRepository> = {}) => {
  const printRepository = {
    list: vi.fn<PrintRepository['list']>(async () => []),
    findInFamily: vi.fn<PrintRepository['findInFamily']>(async (_familyId, id) =>
      id === 'p1' ? print : null,
    ),
    listTopicIds: vi.fn<PrintRepository['listTopicIds']>(async () => ['t1']),
    listImages: vi.fn<PrintRepository['listImages']>(async () => [
      { id: 'old1', page: 1, size: 30 },
    ]),
    listMiteneStates: vi.fn<PrintRepository['listMiteneStates']>(async () => []),
    markViewed: vi.fn<PrintRepository['markViewed']>(async () => {}),
    requestMitene: vi.fn<PrintRepository['requestMitene']>(async () => {}),
    storageUsed: vi.fn<PrintRepository['storageUsed']>(async () => 1000),
    listCreatedSince: vi.fn<PrintRepository['listCreatedSince']>(async () => []),
    findImageInFamily: vi.fn<PrintRepository['findImageInFamily']>(async () => null),
    create: vi.fn<PrintRepository['create']>(async () => 7),
    update: vi.fn<PrintRepository['update']>(async () => 9),
    replaceImages: vi.fn<PrintRepository['replaceImages']>(async () => {}),
    delete: vi.fn<PrintRepository['delete']>(async () => {}),
    countCreatedBy: vi.fn<PrintRepository['countCreatedBy']>(async () => 2),
    listImagesCreatedBy: vi.fn<PrintRepository['listImagesCreatedBy']>(async () => [
      { printId: 'p8', imageId: 'i8' },
    ]),
    deleteCreatedBy: vi.fn<PrintRepository['deleteCreatedBy']>(async () => {}),
  }
  // Assigned rather than spread so the fake keeps its mock types for the methods not overridden.
  Object.assign(printRepository, overrides)
  const childRepository = {
    findInFamily: vi.fn<ChildRepository['findInFamily']>(async (_familyId, id) =>
      id === 'c1'
        ? { id: 'c1', familyId: 'f1', name: 'はなこ' }
        : id === 'c2'
          ? { id: 'c2', familyId: 'f1', name: 'たろう' }
          : null,
    ),
  } as unknown as ChildRepository
  const topicRepository = {
    listByFamily: vi.fn<TopicRepository['listByFamily']>(async () => [
      { id: 't1', familyId: 'f1', name: '試合' },
      { id: 't2', familyId: 'f1', name: 'サッカークラブ' },
    ]),
  } as unknown as TopicRepository
  const imageRepository = {
    putImages: vi.fn<ImageRepository['putImages']>(async () => {}),
    getImage: vi.fn<ImageRepository['getImage']>(async () => null),
    deleteImages: vi.fn<ImageRepository['deleteImages']>(async () => {}),
    deleteFamilyImages: vi.fn<ImageRepository['deleteFamilyImages']>(async () => {}),
  }
  const service = createPrintService({
    printRepository,
    childRepository,
    topicRepository,
    imageRepository,
  })
  return { service, printRepository, imageRepository }
}

const newPrint = {
  childId: 'c1',
  title: null,
  receivedOn: '2026-09-25',
  dueOn: null,
  topicIds: ['t2', 't1'],
  responseStatus: 'todo' as const,
  images: [jpeg(), jpeg()],
}

beforeEach(() => {
  vi.useFakeTimers({ now })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

test('list queries the caller’s view with today in JST and drops the family id', async () => {
  const list = vi.fn<PrintRepository['list']>(async () => [
    {
      ...print,
      topicIds: [],
      imageCount: 1,
      coverImageId: 'i1',
      isRead: false,
      miteneStatus: 'none',
    },
  ])
  const { service } = createService({ list })

  const items = await service.list(invitedUser, {
    childId: null,
    sort: 'due',
    topicIds: ['t1'],
    read: false,
  })

  expect(items[0]).not.toHaveProperty('familyId')
  expect(list).toHaveBeenCalledWith({
    familyId: 'f1',
    memberId: invitedUser.id,
    today: '2026-09-28',
    childId: null,
    sort: 'due',
    topicIds: ['t1'],
    read: false,
  })
})

test('detail marks the print viewed first, then reports sent and received mitene', async () => {
  const { service, printRepository } = createService({
    listMiteneStates: vi.fn<PrintRepository['listMiteneStates']>(async () => [
      {
        memberId: invitedUser.id,
        memberName: '二郎',
        status: 'seen',
        fromMemberId: 'owner',
        fromMemberName: '一郎',
      },
      {
        memberId: 'm3',
        memberName: '三郎',
        status: 'requested',
        fromMemberId: invitedUser.id,
        fromMemberName: '二郎',
      },
    ]),
  })

  const detail = await service.detail(invitedUser, 'p1')

  expect(printRepository.markViewed).toHaveBeenCalledWith('p1', invitedUser.id)
  expect(printRepository.markViewed.mock.invocationCallOrder[0]).toBeLessThan(
    printRepository.listMiteneStates.mock.invocationCallOrder[0],
  )
  expect(detail).toMatchObject({
    id: 'p1',
    seq: 1,
    topicIds: ['t1'],
    images: [{ id: 'old1', page: 1 }],
    isRead: true,
    miteneStatus: 'seen',
    miteneSent: [{ memberId: 'm3', memberName: '三郎', status: 'requested' }],
    miteneReceived: { fromMemberId: 'owner', fromMemberName: '一郎', status: 'seen' },
  })
  expect(detail).not.toHaveProperty('familyId')
})

test('detail answers not_found for a print outside the family, without marking anything', async () => {
  const { service, printRepository } = createService()

  await expect(service.detail(invitedUser, 'other')).rejects.toMatchObject({ code: 'not_found' })
  expect(printRepository.markViewed).not.toHaveBeenCalled()
})

test('create stores the photos, then the print with its history', async () => {
  const { service, printRepository, imageRepository } = createService()

  const ref = await service.create(invitedUser, newPrint)

  expect(ref).toEqual({ id: expect.any(String), childId: 'c1', seq: 7 })
  const [stored] = imageRepository.putImages.mock.calls[0]
  expect(stored).toBe('f1')
  const [input, writtenAt] = printRepository.create.mock.calls[0]
  expect(writtenAt).toBe(now)
  expect(input).toMatchObject({
    print: { id: ref.id, familyId: 'f1', childId: 'c1', responseStatus: 'todo', createdAt: now },
    images: [
      { page: 1, size: 10 },
      { page: 2, size: 10 },
    ],
    topicIds: ['t2', 't1'],
    creatorId: invitedUser.id,
    history: {
      memberName: invitedUser.name,
      target: 'print',
      action: 'create',
      name: 'はなこ',
      details: {
        topics: ['サッカークラブ', '試合'],
        received_on: '2026-09-25',
        response_status: 'todo',
      },
    },
  })
  expect(input.history).not.toHaveProperty('printSeq')
  expect(imageRepository.putImages.mock.calls[0][1].map((image) => image.imageId)).toEqual(
    input.images.map((image: { id: string }) => image.id),
  )
})

test('create records the family-common slot by its name', async () => {
  const { service, printRepository } = createService()

  const ref = await service.create(invitedUser, { ...newPrint, childId: null })

  expect(ref.childId).toBeNull()
  expect(printRepository.create.mock.calls[0][0].history.name).toBe('家族共通')
})

test('create rejects a non-JPEG upload before storing anything', async () => {
  const { service, imageRepository } = createService()

  await expect(
    service.create(invitedUser, { ...newPrint, images: [jpeg(), png()] }),
  ).rejects.toMatchObject({ code: 'invalid_input', details: { field: 'images', page: 2 } })
  expect(imageRepository.putImages).not.toHaveBeenCalled()
})

test('create answers not_found for a child or topic outside the family', async () => {
  const { service } = createService()

  await expect(service.create(invitedUser, { ...newPrint, childId: 'cx' })).rejects.toMatchObject({
    code: 'not_found',
  })
  await expect(
    service.create(invitedUser, { ...newPrint, topicIds: ['tx'] }),
  ).rejects.toMatchObject({ code: 'not_found' })
})

test('create refuses photos that would exceed the storage quota', async () => {
  const { service, imageRepository } = createService({
    storageUsed: async () => LIMITS.familyStorageBytes - 15,
  })

  await expect(service.create(invitedUser, newPrint)).rejects.toMatchObject({
    code: 'storage_limit',
  })
  expect(imageRepository.putImages).not.toHaveBeenCalled()
})

test('create removes the stored photos when writing the print fails', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const { service, imageRepository } = createService({
    create: async () => {
      throw new Error('D1 down')
    },
  })

  await expect(service.create(invitedUser, newPrint)).rejects.toThrow('D1 down')
  const stored = imageRepository.putImages.mock.calls[0][1].map(({ printId, imageId }) => ({
    printId,
    imageId,
  }))
  expect(imageRepository.deleteImages).toHaveBeenCalledWith('f1', stored)
})

test('update with nothing changed writes nothing', async () => {
  const { service, printRepository } = createService()

  expect(
    await service.update(invitedUser, 'p1', { title: '遠足', topicIds: ['t1'], childId: 'c1' }),
  ).toEqual({ id: 'p1', childId: 'c1', seq: 1 })
  expect(printRepository.update).not.toHaveBeenCalled()
})

test('update writes only the changed fields and records their new values', async () => {
  const { service, printRepository } = createService()

  await service.update(invitedUser, 'p1', {
    title: '遠足',
    dueOn: '2026-10-02',
    responseStatus: 'done',
    topicIds: ['t1', 't2'],
  })

  expect(printRepository.update).toHaveBeenCalledWith(
    {
      print,
      changes: { dueOn: '2026-10-02', responseStatus: 'done' },
      topicIds: ['t1', 't2'],
      move: undefined,
      histories: [
        {
          memberName: invitedUser.name,
          target: 'print',
          action: 'update',
          name: 'はなこ',
          printSeq: 1,
          details: {
            topics: ['試合', 'サッカークラブ'],
            due_on: '2026-10-02',
            response_status: 'done',
          },
        },
      ],
    },
    now,
  )
})

test('update moving to another slot records a delete and a create under the new number', async () => {
  const { service, printRepository } = createService()

  expect(
    await service.update(invitedUser, 'p1', { childId: 'c2', title: '遠足のお知らせ' }),
  ).toEqual({ id: 'p1', childId: 'c2', seq: 9 })
  const [input] = printRepository.update.mock.calls[0]
  expect(input.move).toEqual({ childId: 'c2' })
  expect(input.histories).toEqual([
    {
      memberName: invitedUser.name,
      target: 'print',
      action: 'delete',
      name: 'はなこ',
      printSeq: 1,
    },
    {
      memberName: invitedUser.name,
      target: 'print',
      action: 'create',
      name: 'たろう',
      details: { title: '遠足のお知らせ', topics: ['試合'], due_on: '2026-10-03' },
    },
  ])
})

test('update answers not_found for an unknown print, target child or topic', async () => {
  const { service } = createService()

  await expect(service.update(invitedUser, 'other', { title: 'x' })).rejects.toMatchObject({
    code: 'not_found',
  })
  await expect(service.update(invitedUser, 'p1', { childId: 'cx' })).rejects.toMatchObject({
    code: 'not_found',
  })
  await expect(service.update(invitedUser, 'p1', { topicIds: ['tx'] })).rejects.toMatchObject({
    code: 'not_found',
  })
})

test('replaceImages checks the quota without the old photos, then swaps them', async () => {
  const { service, printRepository, imageRepository } = createService({
    // Full except for the old 30-byte photo: 20 new bytes fit only because the old ones go.
    storageUsed: async () => LIMITS.familyStorageBytes,
  })

  const { images } = await service.replaceImages(invitedUser, 'p1', [jpeg(), jpeg()])

  expect(images.map((image) => image.page)).toEqual([1, 2])
  const [, , history] = printRepository.replaceImages.mock.calls[0]
  expect(history).toEqual({
    memberName: invitedUser.name,
    target: 'print',
    action: 'update',
    name: 'はなこ',
    printSeq: 1,
    details: { image_count: 2 },
  })
  expect(imageRepository.deleteImages).toHaveBeenCalledWith('f1', [
    { printId: 'p1', imageId: 'old1' },
  ])
})

test('replaceImages over the quota keeps the old photos', async () => {
  const { service, printRepository, imageRepository } = createService({
    storageUsed: async () => LIMITS.familyStorageBytes,
  })

  await expect(service.replaceImages(invitedUser, 'p1', [jpeg(40)])).rejects.toMatchObject({
    code: 'storage_limit',
  })
  expect(imageRepository.putImages).not.toHaveBeenCalled()
  expect(printRepository.replaceImages).not.toHaveBeenCalled()
})

test('replaceImages removes the new photos and keeps the old ones when the write fails', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const { service, imageRepository } = createService({
    replaceImages: async () => {
      throw new Error('D1 down')
    },
  })

  await expect(service.replaceImages(invitedUser, 'p1', [jpeg()])).rejects.toThrow('D1 down')
  const [, deleted] = imageRepository.deleteImages.mock.calls[0]
  expect(deleted.map((ref) => ref.imageId)).not.toContain('old1')
  expect(imageRepository.deleteImages).toHaveBeenCalledTimes(1)
})

test('delete records the print and then deletes its photos', async () => {
  const { service, printRepository, imageRepository } = createService()

  await service.delete(invitedUser, 'p1')

  expect(printRepository.delete).toHaveBeenCalledWith(
    print,
    {
      memberName: invitedUser.name,
      target: 'print',
      action: 'delete',
      name: 'はなこ',
      printSeq: 1,
    },
    now,
  )
  expect(imageRepository.deleteImages).toHaveBeenCalledWith('f1', [
    { printId: 'p1', imageId: 'old1' },
  ])
})

test('countOld and deleteOld use the JST calendar months before now', async () => {
  const { service, printRepository, imageRepository } = createService()
  // 2026-06-28 12:00 JST.
  const cutoff = Date.UTC(2026, 5, 28, 3)

  expect(await service.countOld(invitedUser, 3)).toEqual({ count: 2 })
  expect(printRepository.countCreatedBy).toHaveBeenCalledWith('f1', cutoff)

  expect(await service.deleteOld(invitedUser, 3)).toEqual({ count: 2 })
  expect(printRepository.deleteCreatedBy).toHaveBeenCalledWith(
    'f1',
    cutoff,
    {
      memberName: invitedUser.name,
      target: 'print',
      action: 'bulk_delete',
      details: { older_than_months: 3, print_count: 2 },
    },
    now,
  )
  expect(imageRepository.deleteImages).toHaveBeenCalledWith('f1', [
    { printId: 'p8', imageId: 'i8' },
  ])
})

test('deleteOld with nothing to delete writes no history', async () => {
  const { service, printRepository } = createService({ countCreatedBy: async () => 0 })

  expect(await service.deleteOld(invitedUser, 12)).toEqual({ count: 0 })
  expect(printRepository.deleteCreatedBy).not.toHaveBeenCalled()
})

test('getImage serves only an image of the family that exists in storage', async () => {
  const stored = { body: new Blob(['x']).stream(), size: 1 }
  const { service, printRepository, imageRepository } = createService()

  await expect(service.getImage(invitedUser, 'i1')).rejects.toMatchObject({ code: 'not_found' })

  printRepository.findImageInFamily.mockResolvedValue({ printId: 'p1', imageId: 'i1' })
  await expect(service.getImage(invitedUser, 'i1')).rejects.toMatchObject({ code: 'not_found' })

  imageRepository.getImage.mockResolvedValue(stored)
  expect(await service.getImage(invitedUser, 'i1')).toBe(stored)
  expect(imageRepository.getImage).toHaveBeenCalledWith('f1', { printId: 'p1', imageId: 'i1' })
})
