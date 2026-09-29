import type { HistoryRecord } from './history.interface.ts'

/** A `members` row as D1 returns it. */
export interface MemberRecord {
  id: string
  family_id: string
  name: string
  google_sub: string | null
  key_hash: string | null
  terms_version: string | null
  terms_agreed_at: number | null
}

export interface CreateInvitedMemberInput {
  id: string
  familyId: string
  name: string
  keyHash: string
  termsVersion: string
  /** Unix epoch milliseconds; used for `terms_agreed_at` and the family's `last_accessed_at`. */
  now: number
  /** The member is only inserted while the family has fewer members than this. */
  maxMembers: number
}

export interface MemberDao {
  findById: (id: string) => Promise<MemberRecord | null>
  findByKeyHash: (keyHash: string) => Promise<MemberRecord | null>
  findByGoogleSub: (googleSub: string) => Promise<MemberRecord | null>
  listByFamily: (familyId: string) => Promise<MemberRecord[]>
  /**
   * Inserts an invited member (and records the family access) atomically, with the member-count
   * check done in the same statement so concurrent joins can't exceed `maxMembers`.
   * Writes its history row in the same batch, only when the member was inserted.
   * Resolves `false` if the family was already full. Throws `UniqueConstraintError` if the name is taken.
   */
  createInvited: (input: CreateInvitedMemberInput, history: HistoryRecord) => Promise<boolean>
  /** Renames a member and writes its history row atomically. Throws `UniqueConstraintError` if the name is taken. */
  rename: (memberId: string, name: string, history: HistoryRecord) => Promise<void>
  agreeTerms: (memberId: string, termsVersion: string, now: number) => Promise<void>
  /**
   * Removes a member (deletion or leaving) atomically with the spec's cleanup: mitene they sent
   * are withdrawn (recipients back to `none`, read state kept); their own states go by cascade.
   * Writes its history row in the same batch.
   */
  delete: (memberId: string, history: HistoryRecord) => Promise<void>
}
