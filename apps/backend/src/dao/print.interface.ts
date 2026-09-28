import type { PrintImageRefRecord } from './child.interface.ts'
import type { HistoryRecord } from './history.interface.ts'

export type ResponseStatus = 'none' | 'todo' | 'done'
export type MiteneStatus = 'none' | 'requested' | 'seen'

/** A `prints` row. `child_id` NULL is the family-common slot. */
export interface PrintRecord {
  id: string
  family_id: string
  child_id: string | null
  seq: number
  title: string | null
  received_on: string | null
  due_on: string | null
  response_status: ResponseStatus
  created_at: number
}

/** A print in a list, with the viewer's personal state and summary columns. */
export interface PrintListRecord extends PrintRecord {
  is_read: number
  mitene_status: MiteneStatus
  /** Who sent the viewer's mitene (their current name); `null` without one. */
  mitene_from_name: string | null
  /** JSON array of topic ids. */
  topic_ids: string
  image_count: number
  cover_image_id: string | null
}

export interface PrintListQuery {
  familyId: string
  /** `null` is the family-common slot. */
  childId: string | null
  /** Whose read/mitene state to join and filter by. */
  memberId: string
  /** `created`: newest first, all prints. `due`: earliest due first, only prints with a due date, hiding past ones unless still `todo`. */
  sort: 'created' | 'due'
  /** JST `YYYY-MM-DD`; "past" for `sort: 'due'` means before this. */
  today: string
  /** Prints having all of these topics. */
  topicIds: string[]
  read?: boolean
  responseStatus?: ResponseStatus
  miteneStatus?: MiteneStatus
}

/** When a print was registered, and in which slot (for stats). */
export interface PrintCreatedRecord {
  child_id: string | null
  created_at: number
}

/** A `print_images` row. */
export interface PrintImageRecord {
  id: string
  print_id: string
  page: number
  size: number
}

/** A non-`none` mitene state on a print, with the names of both members. */
export interface MiteneStateRecord {
  member_id: string
  member_name: string
  mitene_status: 'requested' | 'seen'
  mitene_from: string | null
  from_name: string | null
}

export interface NewPrintInput {
  /** `seq` is assigned by the DAO: the slot's next sequence number. */
  print: Omit<PrintRecord, 'seq'>
  images: PrintImageRecord[]
  topicIds: string[]
  /** Marked as having read the print (spec: registering it counts as reading it). */
  creatorId: string
  history: HistoryRecord
}

/** Only the columns being changed; `null` clears an optional one. */
export interface PrintChanges {
  title?: string | null
  received_on?: string | null
  due_on?: string | null
  response_status?: ResponseStatus
}

export interface UpdatePrintInput {
  printId: string
  familyId: string
  changes: PrintChanges
  /** Replaces the print's topics when given. */
  topicIds?: string[]
  /** Moves the print to another slot (`childId` null = family-common) with that slot's next sequence number. */
  move?: { childId: string | null }
  histories: HistoryRecord[]
}

/**
 * Every write takes the history row(s) it records and runs as one atomic batch. A print history
 * row whose `print_seq` is null gets the print's sequence number as stored after the write — the
 * one the DAO assigns on create or move.
 */
export interface PrintDao {
  list: (query: PrintListQuery) => Promise<PrintListRecord[]>
  findInFamily: (familyId: string, id: string) => Promise<PrintRecord | null>
  listTopicIds: (printId: string) => Promise<string[]>
  /** In page order. */
  listImages: (printId: string) => Promise<PrintImageRecord[]>
  listMiteneStates: (printId: string) => Promise<MiteneStateRecord[]>
  /**
   * Sends mitene: each recipient's state becomes `requested` from `fromMemberId`, overwriting an
   * earlier mitene (spec: the later one wins). Read state is kept.
   */
  requestMitene: (printId: string, fromMemberId: string, memberIds: string[]) => Promise<void>
  /** Opening the detail: marks it read, and turns a `requested` mitene into `seen`. */
  markViewed: (printId: string, memberId: string) => Promise<void>
  /** Total bytes of the family's photos. */
  storageUsed: (familyId: string) => Promise<number>
  /** Slot and registration time of each of the family's prints registered at or after `since`. */
  listCreatedSince: (familyId: string, since: number) => Promise<PrintCreatedRecord[]>
  findImageInFamily: (familyId: string, imageId: string) => Promise<PrintImageRecord | null>
  /** Resolves the assigned sequence number. */
  create: (input: NewPrintInput) => Promise<number>
  /** Resolves the sequence number after the update (new if moved). */
  update: (input: UpdatePrintInput) => Promise<number>
  /** Replaces all pages. */
  replaceImages: (
    printId: string,
    images: PrintImageRecord[],
    history: HistoryRecord,
  ) => Promise<void>
  delete: (printId: string, history: HistoryRecord) => Promise<void>
  /** Prints registered at or before `cutoff` (Unix ms), family-wide. */
  countCreatedBy: (familyId: string, cutoff: number) => Promise<number>
  /** Total photo bytes of the prints `countCreatedBy` counts (what deleting them frees). */
  imageBytesCreatedBy: (familyId: string, cutoff: number) => Promise<number>
  listImagesCreatedBy: (familyId: string, cutoff: number) => Promise<PrintImageRefRecord[]>
  deleteCreatedBy: (familyId: string, cutoff: number, history: HistoryRecord) => Promise<void>
}
