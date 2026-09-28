import type { HistoryRecord } from './history.interface.ts'

/** A `topics` row. */
export interface TopicRecord {
  id: string
  family_id: string
  name: string
}

export interface TopicDao {
  listByFamily: (familyId: string) => Promise<TopicRecord[]>
  findInFamily: (familyId: string, id: string) => Promise<TopicRecord | null>
  /** Throws `UniqueConstraintError` if the name is taken. */
  create: (record: TopicRecord, history: HistoryRecord) => Promise<void>
  /** Throws `UniqueConstraintError` if the name is taken. */
  rename: (id: string, name: string, history: HistoryRecord) => Promise<void>
  /** Deletes the topic; it comes off every print by cascade. */
  delete: (id: string, history: HistoryRecord) => Promise<void>
}
