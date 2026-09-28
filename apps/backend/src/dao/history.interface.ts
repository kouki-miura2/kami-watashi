/**
 * A `histories` row. History is written inside the same atomic batch as the operation it
 * records, so write methods on other DAOs take one of these; `HistoryDao` only reads.
 */
export interface HistoryRecord {
  id: string
  family_id: string
  member_name: string
  target: 'child' | 'topic' | 'print' | 'member'
  action: 'create' | 'update' | 'delete' | 'bulk_delete'
  name: string | null
  new_name: string | null
  print_seq: number | null
  /** JSON text. */
  details: string | null
  created_at: number
}

/** A history row with its SQLite `rowid` (insertion order), which breaks ties in `created_at`. */
export interface HistoryListRecord extends HistoryRecord {
  rowid: number
}

/** Position after the last row of a page: rows strictly older than this come next. */
export interface HistoryPosition {
  createdAt: number
  rowid: number
}

export interface HistoryDao {
  /** Newest first (by `created_at`, then insertion order), starting after `after` if given. */
  listPage: (
    familyId: string,
    after: HistoryPosition | null,
    limit: number,
  ) => Promise<HistoryListRecord[]>
}
