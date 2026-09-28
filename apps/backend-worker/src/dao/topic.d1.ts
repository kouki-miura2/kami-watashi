import type {
  TopicDao,
  TopicRecord,
  TopicWithPrintCountRecord,
} from 'backend/src/dao/topic.interface.ts'

import { rethrowUniqueConstraint } from './d1-errors.ts'
import { insertHistory } from './history.d1.ts'

export const createTopicD1Dao = (db: D1Database): TopicDao => ({
  listByFamily: async (familyId) =>
    (
      await db
        .prepare('SELECT id, family_id, name FROM topics WHERE family_id = ?')
        .bind(familyId)
        .all<TopicRecord>()
    ).results,

  listWithPrintCounts: async (familyId) =>
    (
      await db
        .prepare(
          `SELECT t.id, t.family_id, t.name, COUNT(pt.print_id) AS print_count
           FROM topics t LEFT JOIN print_topics pt ON pt.topic_id = t.id
           WHERE t.family_id = ?
           GROUP BY t.id`,
        )
        .bind(familyId)
        .all<TopicWithPrintCountRecord>()
    ).results,

  findInFamily: async (familyId, id) =>
    db
      .prepare('SELECT id, family_id, name FROM topics WHERE family_id = ? AND id = ?')
      .bind(familyId, id)
      .first<TopicRecord>(),

  create: async (record, history) => {
    await db
      .batch([
        db
          .prepare('INSERT INTO topics (id, family_id, name) VALUES (?, ?, ?)')
          .bind(record.id, record.family_id, record.name),
        insertHistory(db, history),
      ])
      .catch(rethrowUniqueConstraint)
  },

  rename: async (id, name, history) => {
    await db
      .batch([
        db.prepare('UPDATE topics SET name = ? WHERE id = ?').bind(name, id),
        insertHistory(db, history),
      ])
      .catch(rethrowUniqueConstraint)
  },

  delete: async (id, history) => {
    await db.batch([
      insertHistory(db, history),
      db.prepare('DELETE FROM topics WHERE id = ?').bind(id),
    ])
  },
})
