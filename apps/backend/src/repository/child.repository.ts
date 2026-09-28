import type { ChildDao, ChildRecord, SlotCountRecord } from '../dao/child.interface.ts'
import { type HistoryEntry, toHistoryRecord } from './history.repository.ts'
import type { ImageRef } from './image.repository.ts'

export interface Child {
  id: string
  familyId: string
  name: string
}

/** A count per slot; `childId` null is the family-common slot. */
export interface SlotCount {
  childId: string | null
  count: number
}

export interface ChildRepository {
  /** In registration order. */
  listByFamily: (familyId: string) => Promise<Child[]>
  findInFamily: (familyId: string, id: string) => Promise<Child | null>
  countPrintsSince: (familyId: string, since: number) => Promise<SlotCount[]>
  countMiteneRequested: (memberId: string) => Promise<SlotCount[]>
  countPrints: (childId: string) => Promise<number>
  listImages: (childId: string) => Promise<ImageRef[]>
  /** Throws `UniqueConstraintError` if the name is taken. */
  create: (child: Child, history: HistoryEntry, now: number) => Promise<void>
  /** Throws `UniqueConstraintError` if the name is taken. */
  rename: (child: Child, name: string, history: HistoryEntry, now: number) => Promise<void>
  delete: (child: Child, history: HistoryEntry, now: number) => Promise<void>
}

const toChild = (record: ChildRecord): Child => ({
  id: record.id,
  familyId: record.family_id,
  name: record.name,
})

const toSlotCount = (record: SlotCountRecord): SlotCount => ({
  childId: record.child_id,
  count: record.count,
})

export const createChildRepository = (dao: ChildDao): ChildRepository => ({
  listByFamily: async (familyId) => (await dao.listByFamily(familyId)).map(toChild),
  findInFamily: async (familyId, id) => {
    const record = await dao.findInFamily(familyId, id)
    return record ? toChild(record) : null
  },
  countPrintsSince: async (familyId, since) =>
    (await dao.countPrintsSince(familyId, since)).map(toSlotCount),
  countMiteneRequested: async (memberId) =>
    (await dao.countMiteneRequested(memberId)).map(toSlotCount),
  countPrints: async (childId) => dao.countPrints(childId),
  listImages: async (childId) =>
    (await dao.listImages(childId)).map((record) => ({
      printId: record.print_id,
      imageId: record.image_id,
    })),
  create: async (child, history, now) =>
    dao.create(
      { id: child.id, family_id: child.familyId, name: child.name, last_print_seq: 0 },
      toHistoryRecord(child.familyId, history, now),
    ),
  rename: async (child, name, history, now) =>
    dao.rename(child.id, name, toHistoryRecord(child.familyId, history, now)),
  delete: async (child, history, now) =>
    dao.delete(child.id, toHistoryRecord(child.familyId, history, now)),
})
