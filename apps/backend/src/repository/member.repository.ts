import type {
  MemberDao,
  MemberRecord,
  MemberWithDataVersionRecord,
} from '../dao/member.interface.ts'
import { type HistoryEntry, toHistoryRecord } from './history.repository.ts'

export interface Member {
  id: string
  familyId: string
  name: string
  /** The owner is the member who signed in with Google (`google_sub` is set). */
  isOwner: boolean
  termsVersion: string | null
}

/** A member looked up by credential (the auth guard), with their family's data version. */
export interface MemberWithDataVersion extends Member {
  /** `families.data_version`: bumped on every change to the family's data. */
  dataVersion: number
}

export interface NewInvitedMember {
  id: string
  familyId: string
  name: string
  keyHash: string
  termsVersion: string
  now: number
  maxMembers: number
}

export interface MemberRepository {
  findById: (id: string) => Promise<MemberWithDataVersion | null>
  findByKeyHash: (keyHash: string) => Promise<MemberWithDataVersion | null>
  findByGoogleSub: (googleSub: string) => Promise<Member | null>
  listByFamily: (familyId: string) => Promise<Member[]>
  /** `false` if the family was already full. Throws `UniqueConstraintError` if the name is taken. */
  createInvited: (member: NewInvitedMember, history: HistoryEntry) => Promise<boolean>
  /** Throws `UniqueConstraintError` if the name is taken. */
  rename: (
    member: Pick<Member, 'id' | 'familyId'>,
    name: string,
    history: HistoryEntry,
    now: number,
  ) => Promise<void>
  agreeTerms: (memberId: string, termsVersion: string, now: number) => Promise<void>
  delete: (
    member: Pick<Member, 'id' | 'familyId'>,
    history: HistoryEntry,
    now: number,
  ) => Promise<void>
}

const toMember = (record: MemberRecord): Member => ({
  id: record.id,
  familyId: record.family_id,
  name: record.name,
  isOwner: record.google_sub !== null,
  termsVersion: record.terms_version,
})

const toMemberOrNull = (record: MemberRecord | null): Member | null =>
  record ? toMember(record) : null

const withDataVersionOrNull = (
  record: MemberWithDataVersionRecord | null,
): MemberWithDataVersion | null =>
  record ? { ...toMember(record), dataVersion: record.data_version } : null

export const createMemberRepository = (dao: MemberDao): MemberRepository => ({
  findById: async (id) => withDataVersionOrNull(await dao.findById(id)),
  findByKeyHash: async (keyHash) => withDataVersionOrNull(await dao.findByKeyHash(keyHash)),
  findByGoogleSub: async (googleSub) => toMemberOrNull(await dao.findByGoogleSub(googleSub)),
  listByFamily: async (familyId) => (await dao.listByFamily(familyId)).map(toMember),
  createInvited: async (member, history) =>
    dao.createInvited(member, toHistoryRecord(member.familyId, history, member.now)),
  rename: async (member, name, history, now) =>
    dao.rename(member.id, name, toHistoryRecord(member.familyId, history, now)),
  agreeTerms: async (memberId, termsVersion, now) => dao.agreeTerms(memberId, termsVersion, now),
  delete: async (member, history, now) =>
    dao.delete(member.id, toHistoryRecord(member.familyId, history, now)),
})
