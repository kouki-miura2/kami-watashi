import type { MemberDao, MemberRecord } from 'backend/src/dao/member.interface.ts'

import { rethrowUniqueConstraint } from './d1-errors.ts'
import { insertHistory } from './history.d1.ts'

const COLUMNS = 'id, family_id, name, google_sub, key_hash, terms_version, terms_agreed_at'

export const createMemberD1Dao = (db: D1Database): MemberDao => {
  const findOneBy = async (column: 'id' | 'key_hash' | 'google_sub', value: string) =>
    db
      .prepare(`SELECT ${COLUMNS} FROM members WHERE ${column} = ?`)
      .bind(value)
      .first<MemberRecord>()

  return {
    findById: async (id) => findOneBy('id', id),
    findByKeyHash: async (keyHash) => findOneBy('key_hash', keyHash),
    findByGoogleSub: async (googleSub) => findOneBy('google_sub', googleSub),
    listByFamily: async (familyId) =>
      (
        await db
          .prepare(`SELECT ${COLUMNS} FROM members WHERE family_id = ?`)
          .bind(familyId)
          .all<MemberRecord>()
      ).results,

    createInvited: async ({ id, familyId, name, keyHash, termsVersion, now, maxMembers }) => {
      const [insert] = await db
        .batch([
          // The count is checked inside the INSERT itself, so two devices joining at once can't
          // both pass a separate "is there room?" check.
          db
            .prepare(
              `INSERT INTO members (id, family_id, name, google_sub, key_hash, terms_version, terms_agreed_at)
               SELECT ?, ?, ?, NULL, ?, ?, ?
               WHERE (SELECT COUNT(*) FROM members WHERE family_id = ?) < ?`,
            )
            .bind(id, familyId, name, keyHash, termsVersion, now, familyId, maxMembers),
          db.prepare('UPDATE families SET last_accessed_at = ? WHERE id = ?').bind(now, familyId),
        ])
        .catch(rethrowUniqueConstraint)
      return insert.meta.changes === 1
    },

    rename: async (memberId, name, history) => {
      await db
        .batch([
          db.prepare('UPDATE members SET name = ? WHERE id = ?').bind(name, memberId),
          insertHistory(db, history),
        ])
        .catch(rethrowUniqueConstraint)
    },

    agreeTerms: async (memberId, termsVersion, now) => {
      await db
        .prepare('UPDATE members SET terms_version = ?, terms_agreed_at = ? WHERE id = ?')
        .bind(termsVersion, now, memberId)
        .run()
    },

    delete: async (memberId) => {
      await db.batch([
        // Withdraw the mitene this member sent; the recipients keep their read state.
        db
          .prepare(
            "UPDATE print_member_states SET mitene_status = 'none', mitene_from = NULL WHERE mitene_from = ?",
          )
          .bind(memberId),
        // Their own read/mitene states go with them (ON DELETE CASCADE).
        db.prepare('DELETE FROM members WHERE id = ?').bind(memberId),
      ])
    },
  }
}
