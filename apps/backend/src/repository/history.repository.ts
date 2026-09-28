import type { HistoryDao, HistoryPosition, HistoryRecord } from '../dao/history.interface.ts'

export type { HistoryPosition }

/**
 * What a service decides to record about an operation. Repositories turn it into a `histories`
 * row (`toHistoryRecord`) and hand it to the DAO that performs the operation, so both are written
 * in one atomic batch.
 */
export interface HistoryEntry {
  /** Display name of the operating member at the time of the operation. */
  memberName: string
  target: HistoryRecord['target']
  action: HistoryRecord['action']
  name?: string | null
  newName?: string | null
  printSeq?: number | null
  details?: Record<string, unknown> | null
}

export const toHistoryRecord = (
  familyId: string,
  entry: HistoryEntry,
  now: number,
): HistoryRecord => ({
  id: crypto.randomUUID(),
  family_id: familyId,
  member_name: entry.memberName,
  target: entry.target,
  action: entry.action,
  name: entry.name ?? null,
  new_name: entry.newName ?? null,
  print_seq: entry.printSeq ?? null,
  details: entry.details ? JSON.stringify(entry.details) : null,
  created_at: now,
})

/** A recorded operation, as read back. */
export interface History {
  id: string
  memberName: string
  target: HistoryRecord['target']
  action: HistoryRecord['action']
  name: string | null
  newName: string | null
  printSeq: number | null
  details: Record<string, unknown> | null
  /** Unix epoch milliseconds. */
  createdAt: number
  /** Where this row sits in the newest-first order (for the next page's cursor). */
  position: HistoryPosition
}

export interface HistoryRepository {
  listPage: (familyId: string, after: HistoryPosition | null, limit: number) => Promise<History[]>
}

export const createHistoryRepository = (dao: HistoryDao): HistoryRepository => ({
  listPage: async (familyId, after, limit) =>
    (await dao.listPage(familyId, after, limit)).map((record) => ({
      id: record.id,
      memberName: record.member_name,
      target: record.target,
      action: record.action,
      name: record.name,
      newName: record.new_name,
      printSeq: record.print_seq,
      details: record.details ? (JSON.parse(record.details) as Record<string, unknown>) : null,
      createdAt: record.created_at,
      position: { createdAt: record.created_at, rowid: record.rowid },
    })),
})
