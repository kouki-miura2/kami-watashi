import type {
  ChildDao,
  ChildRecord,
  PrintImageRefRecord,
  SlotCountRecord,
} from 'backend/src/dao/child.interface.ts'

import { rethrowUniqueConstraint } from './d1-errors.ts'
import { insertHistory } from './history.d1.ts'

const COLUMNS = 'id, family_id, name, last_print_seq'

export const createChildD1Dao = (db: D1Database): ChildDao => ({
  // No created_at column: rowid follows insertion order, which is registration order.
  listByFamily: async (familyId) =>
    (
      await db
        .prepare(`SELECT ${COLUMNS} FROM children WHERE family_id = ? ORDER BY rowid`)
        .bind(familyId)
        .all<ChildRecord>()
    ).results,

  findInFamily: async (familyId, id) =>
    db
      .prepare(`SELECT ${COLUMNS} FROM children WHERE family_id = ? AND id = ?`)
      .bind(familyId, id)
      .first<ChildRecord>(),

  countPrintsSince: async (familyId, since) =>
    (
      await db
        .prepare(
          `SELECT child_id, COUNT(*) AS count FROM prints
           WHERE family_id = ? AND created_at >= ? GROUP BY child_id`,
        )
        .bind(familyId, since)
        .all<SlotCountRecord>()
    ).results,

  countMiteneRequested: async (memberId) =>
    (
      await db
        .prepare(
          `SELECT p.child_id, COUNT(*) AS count
           FROM print_member_states s JOIN prints p ON p.id = s.print_id
           WHERE s.member_id = ? AND s.mitene_status = 'requested'
           GROUP BY p.child_id`,
        )
        .bind(memberId)
        .all<SlotCountRecord>()
    ).results,

  countPrints: async (childId) =>
    (await db
      .prepare('SELECT COUNT(*) AS count FROM prints WHERE child_id = ?')
      .bind(childId)
      .first<number>('count')) ?? 0,

  listImages: async (childId) =>
    (
      await db
        .prepare(
          `SELECT i.print_id, i.id AS image_id
           FROM print_images i JOIN prints p ON p.id = i.print_id
           WHERE p.child_id = ?`,
        )
        .bind(childId)
        .all<PrintImageRefRecord>()
    ).results,

  create: async (record, history) => {
    await db
      .batch([
        db
          .prepare('INSERT INTO children (id, family_id, name, last_print_seq) VALUES (?, ?, ?, ?)')
          .bind(record.id, record.family_id, record.name, record.last_print_seq),
        insertHistory(db, history),
      ])
      .catch(rethrowUniqueConstraint)
  },

  rename: async (id, name, history) => {
    await db
      .batch([
        db.prepare('UPDATE children SET name = ? WHERE id = ?').bind(name, id),
        insertHistory(db, history),
      ])
      .catch(rethrowUniqueConstraint)
  },

  delete: async (id, history) => {
    await db.batch([
      insertHistory(db, history),
      db.prepare('DELETE FROM children WHERE id = ?').bind(id),
    ])
  },
})
