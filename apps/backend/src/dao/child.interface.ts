import type { HistoryRecord } from './history.interface.ts'

/** A `children` row. */
export interface ChildRecord {
  id: string
  family_id: string
  name: string
  last_print_seq: number
}

/** A count per slot; `child_id` NULL is the family-common slot. */
export interface SlotCountRecord {
  child_id: string | null
  count: number
}

/** An image belonging to one of a child's prints (for deleting its R2 object). */
export interface PrintImageRefRecord {
  print_id: string
  image_id: string
}

export interface ChildDao {
  /** In registration order. */
  listByFamily: (familyId: string) => Promise<ChildRecord[]>
  findInFamily: (familyId: string, id: string) => Promise<ChildRecord | null>
  /** Prints registered at or after `since` (Unix ms), per slot. Slots without any are omitted. */
  countPrintsSince: (familyId: string, since: number) => Promise<SlotCountRecord[]>
  /** Prints whose mitene status for `memberId` is `requested`, per slot. */
  countMiteneRequested: (memberId: string) => Promise<SlotCountRecord[]>
  countPrints: (childId: string) => Promise<number>
  listImages: (childId: string) => Promise<PrintImageRefRecord[]>
  /** Throws `UniqueConstraintError` if the name is taken. */
  create: (record: ChildRecord, history: HistoryRecord) => Promise<void>
  /** Throws `UniqueConstraintError` if the name is taken. */
  rename: (id: string, name: string, history: HistoryRecord) => Promise<void>
  /** Deletes the child and, by cascade, its prints and their images/topics/states. */
  delete: (id: string, history: HistoryRecord) => Promise<void>
}
