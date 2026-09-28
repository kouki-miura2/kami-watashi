import type {
  MiteneStatus,
  PrintDao,
  PrintImageRecord,
  PrintListQuery,
  PrintRecord,
  ResponseStatus,
} from '../dao/print.interface.ts'
import { type HistoryEntry, toHistoryRecord } from './history.repository.ts'
import type { ImageRef } from './image.repository.ts'

export type { MiteneStatus, PrintListQuery, ResponseStatus }

export interface Print {
  id: string
  familyId: string
  /** `null` is the family-common slot. */
  childId: string | null
  seq: number
  title: string | null
  /** `YYYY-MM-DD`. */
  receivedOn: string | null
  /** `YYYY-MM-DD`. */
  dueOn: string | null
  responseStatus: ResponseStatus
  /** Unix epoch milliseconds. */
  createdAt: number
}

export interface PrintListItem extends Print {
  topicIds: string[]
  imageCount: number
  coverImageId: string | null
  isRead: boolean
  miteneStatus: MiteneStatus
}

export interface PrintImage {
  id: string
  page: number
  size: number
}

export interface MiteneState {
  memberId: string
  memberName: string
  status: 'requested' | 'seen'
  fromMemberId: string | null
  fromMemberName: string | null
}

export interface NewPrint {
  print: Omit<Print, 'seq'>
  images: PrintImage[]
  topicIds: string[]
  creatorId: string
  /** `printSeq` is left out: the DAO records the sequence number it assigns. */
  history: HistoryEntry
}

export interface PrintUpdate {
  print: Pick<Print, 'id' | 'familyId'>
  changes: Partial<Pick<Print, 'title' | 'receivedOn' | 'dueOn' | 'responseStatus'>>
  topicIds?: string[]
  move?: { childId: string | null }
  /** An entry without `printSeq` records the sequence number after the update. */
  histories: HistoryEntry[]
}

export interface PrintRepository {
  list: (query: PrintListQuery) => Promise<PrintListItem[]>
  findInFamily: (familyId: string, id: string) => Promise<Print | null>
  listTopicIds: (printId: string) => Promise<string[]>
  listImages: (printId: string) => Promise<PrintImage[]>
  listMiteneStates: (printId: string) => Promise<MiteneState[]>
  markViewed: (printId: string, memberId: string) => Promise<void>
  requestMitene: (printId: string, fromMemberId: string, memberIds: string[]) => Promise<void>
  storageUsed: (familyId: string) => Promise<number>
  listCreatedSince: (
    familyId: string,
    since: number,
  ) => Promise<{ childId: string | null; createdAt: number }[]>
  findImageInFamily: (familyId: string, imageId: string) => Promise<ImageRef | null>
  create: (input: NewPrint, now: number) => Promise<number>
  update: (input: PrintUpdate, now: number) => Promise<number>
  replaceImages: (
    print: Pick<Print, 'id' | 'familyId'>,
    images: PrintImage[],
    history: HistoryEntry,
    now: number,
  ) => Promise<void>
  delete: (
    print: Pick<Print, 'id' | 'familyId'>,
    history: HistoryEntry,
    now: number,
  ) => Promise<void>
  countCreatedBy: (familyId: string, cutoff: number) => Promise<number>
  listImagesCreatedBy: (familyId: string, cutoff: number) => Promise<ImageRef[]>
  deleteCreatedBy: (
    familyId: string,
    cutoff: number,
    history: HistoryEntry,
    now: number,
  ) => Promise<void>
}

const toPrint = (record: PrintRecord): Print => ({
  id: record.id,
  familyId: record.family_id,
  childId: record.child_id,
  seq: record.seq,
  title: record.title,
  receivedOn: record.received_on,
  dueOn: record.due_on,
  responseStatus: record.response_status,
  createdAt: record.created_at,
})

const toImageRecord = (printId: string, image: PrintImage): PrintImageRecord => ({
  id: image.id,
  print_id: printId,
  page: image.page,
  size: image.size,
})

export const createPrintRepository = (dao: PrintDao): PrintRepository => ({
  list: async (query) =>
    (await dao.list(query)).map((record) => ({
      ...toPrint(record),
      topicIds: JSON.parse(record.topic_ids) as string[],
      imageCount: record.image_count,
      coverImageId: record.cover_image_id,
      isRead: record.is_read === 1,
      miteneStatus: record.mitene_status,
    })),

  findInFamily: async (familyId, id) => {
    const record = await dao.findInFamily(familyId, id)
    return record ? toPrint(record) : null
  },

  listTopicIds: async (printId) => dao.listTopicIds(printId),

  listImages: async (printId) =>
    (await dao.listImages(printId)).map(({ id, page, size }) => ({ id, page, size })),

  listMiteneStates: async (printId) =>
    (await dao.listMiteneStates(printId)).map((record) => ({
      memberId: record.member_id,
      memberName: record.member_name,
      status: record.mitene_status,
      fromMemberId: record.mitene_from,
      fromMemberName: record.from_name,
    })),

  markViewed: async (printId, memberId) => dao.markViewed(printId, memberId),

  requestMitene: async (printId, fromMemberId, memberIds) =>
    dao.requestMitene(printId, fromMemberId, memberIds),

  storageUsed: async (familyId) => dao.storageUsed(familyId),

  listCreatedSince: async (familyId, since) =>
    (await dao.listCreatedSince(familyId, since)).map((record) => ({
      childId: record.child_id,
      createdAt: record.created_at,
    })),

  findImageInFamily: async (familyId, imageId) => {
    const record = await dao.findImageInFamily(familyId, imageId)
    return record ? { printId: record.print_id, imageId: record.id } : null
  },

  create: async ({ print, images, topicIds, creatorId, history }, now) =>
    dao.create({
      print: {
        id: print.id,
        family_id: print.familyId,
        child_id: print.childId,
        title: print.title,
        received_on: print.receivedOn,
        due_on: print.dueOn,
        response_status: print.responseStatus,
        created_at: print.createdAt,
      },
      images: images.map((image) => toImageRecord(print.id, image)),
      topicIds,
      creatorId,
      history: toHistoryRecord(print.familyId, history, now),
    }),

  update: async ({ print, changes, topicIds, move, histories }, now) =>
    dao.update({
      printId: print.id,
      familyId: print.familyId,
      changes: {
        ...('title' in changes ? { title: changes.title } : {}),
        ...('receivedOn' in changes ? { received_on: changes.receivedOn } : {}),
        ...('dueOn' in changes ? { due_on: changes.dueOn } : {}),
        ...(changes.responseStatus ? { response_status: changes.responseStatus } : {}),
      },
      topicIds,
      move,
      histories: histories.map((entry) => toHistoryRecord(print.familyId, entry, now)),
    }),

  replaceImages: async (print, images, history, now) =>
    dao.replaceImages(
      print.id,
      images.map((image) => toImageRecord(print.id, image)),
      toHistoryRecord(print.familyId, history, now),
    ),

  delete: async (print, history, now) =>
    dao.delete(print.id, toHistoryRecord(print.familyId, history, now)),

  countCreatedBy: async (familyId, cutoff) => dao.countCreatedBy(familyId, cutoff),

  listImagesCreatedBy: async (familyId, cutoff) =>
    (await dao.listImagesCreatedBy(familyId, cutoff)).map((record) => ({
      printId: record.print_id,
      imageId: record.image_id,
    })),

  deleteCreatedBy: async (familyId, cutoff, history, now) =>
    dao.deleteCreatedBy(familyId, cutoff, toHistoryRecord(familyId, history, now)),
})
