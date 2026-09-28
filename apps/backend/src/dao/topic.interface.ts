import type { HistoryRecord } from './history.interface.ts'

/** A `topics` row. */
export interface TopicRecord {
  id: string
  family_id: string
  name: string
}

/** A `topics` row with the number of prints it is set on. */
export interface TopicWithPrintCountRecord extends TopicRecord {
  print_count: number
}

export interface TopicDao {
  listByFamily: (familyId: string) => Promise<TopicRecord[]>
  listWithPrintCounts: (familyId: string) => Promise<TopicWithPrintCountRecord[]>
  findInFamily: (familyId: string, id: string) => Promise<TopicRecord | null>
  /** Throws `UniqueConstraintError` if the name is taken. */
  create: (record: TopicRecord, history: HistoryRecord) => Promise<void>
  /** Throws `UniqueConstraintError` if the name is taken. */
  rename: (id: string, name: string, history: HistoryRecord) => Promise<void>
  /** Deletes the topic; it comes off every print by cascade. */
  delete: (id: string, history: HistoryRecord) => Promise<void>
}
