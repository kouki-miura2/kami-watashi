import type {
  HistoryDao,
  HistoryListRecord,
  HistoryRecord,
} from 'backend/src/dao/history.interface.ts'

/**
 * The INSERT for a history row, to put in the same `db.batch()` as the operation it records.
 * With `seqOfPrintId`, a row whose `print_seq` is null takes that print's `seq` as stored at this
 * point in the batch — how a print's newly assigned sequence number gets into its history.
 */
export const insertHistory = (
  db: D1Database,
  record: HistoryRecord,
  seqOfPrintId?: string,
): D1PreparedStatement => {
  const seqFromPrint = record.print_seq === null && seqOfPrintId !== undefined
  return db
    .prepare(
      `INSERT INTO histories
         (id, family_id, member_name, target, action, name, new_name, print_seq, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ${seqFromPrint ? '(SELECT seq FROM prints WHERE id = ?)' : '?'}, ?, ?)`,
    )
    .bind(
      record.id,
      record.family_id,
      record.member_name,
      record.target,
      record.action,
      record.name,
      record.new_name,
      seqFromPrint ? seqOfPrintId : record.print_seq,
      record.details,
      record.created_at,
    )
}

export const createHistoryD1Dao = (db: D1Database): HistoryDao => ({
  listPage: async (familyId, after, limit) => {
    // Newest first; rows written in one batch share `created_at`, and `rowid` (insertion order)
    // keeps e.g. a move's "delete" before its "create".
    const cursor = after ? 'AND (created_at < ? OR (created_at = ? AND rowid < ?))' : ''
    return (
      await db
        .prepare(
          `SELECT rowid, id, family_id, member_name, target, action, name, new_name, print_seq, details, created_at
           FROM histories
           WHERE family_id = ? ${cursor}
           ORDER BY created_at DESC, rowid DESC
           LIMIT ?`,
        )
        .bind(familyId, ...(after ? [after.createdAt, after.createdAt, after.rowid] : []), limit)
        .all<HistoryListRecord>()
    ).results
  },
})
