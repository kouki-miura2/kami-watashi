import type { FamilyDao } from 'backend/src/dao/family.interface.ts'

import { rethrowUniqueConstraint } from './d1-errors.ts'

export const createFamilyD1Dao = (db: D1Database): FamilyDao => ({
  createWithOwner: async ({ familyId, ownerId, ownerName, googleSub, termsVersion, now }) => {
    await db
      .batch([
        db
          .prepare('INSERT INTO families (id, last_accessed_at, last_print_seq) VALUES (?, ?, 0)')
          .bind(familyId, now),
        db
          .prepare(
            `INSERT INTO members (id, family_id, name, google_sub, key_hash, terms_version, terms_agreed_at)
           VALUES (?, ?, ?, ?, NULL, ?, ?)`,
          )
          .bind(ownerId, familyId, ownerName, googleSub, termsVersion, now),
      ])
      .catch(rethrowUniqueConstraint)
  },
  touch: async (familyId, now) => {
    await db
      .prepare('UPDATE families SET last_accessed_at = ? WHERE id = ?')
      .bind(now, familyId)
      .run()
  },
  listInactive: async (before, limit) =>
    (
      await db
        .prepare(
          'SELECT id FROM families WHERE last_accessed_at < ? ORDER BY last_accessed_at LIMIT ?',
        )
        .bind(before, limit)
        .all<{ id: string }>()
    ).results.map((row) => row.id),
  delete: async (familyId) => {
    await db.prepare('DELETE FROM families WHERE id = ?').bind(familyId).run()
  },
})
