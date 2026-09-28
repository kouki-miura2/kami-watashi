import type { PrintImageRefRecord } from 'backend/src/dao/child.interface.ts'
import type {
  MiteneStateRecord,
  PrintChanges,
  PrintCreatedRecord,
  PrintDao,
  PrintImageRecord,
  PrintListRecord,
  PrintRecord,
} from 'backend/src/dao/print.interface.ts'

import { insertHistory } from './history.d1.ts'

const PRINT_COLUMNS =
  'id, family_id, child_id, seq, title, received_on, due_on, response_status, created_at'

/** Updatable columns, whitelisted so a key of `PrintChanges` can go into SQL as a column name. */
const CHANGE_COLUMNS: (keyof PrintChanges)[] = ['title', 'received_on', 'due_on', 'response_status']

/**
 * Sequence numbering (spec "プリントの連番"): `bump` advances the slot's counter — the child's, or
 * the family's for the family-common slot — and `current` reads it back inside the same batch.
 * Numbers are never reused, since the counter only goes up.
 */
const nextSeq = (db: D1Database, familyId: string, childId: string | null) =>
  childId === null
    ? {
        bump: db
          .prepare('UPDATE families SET last_print_seq = last_print_seq + 1 WHERE id = ?')
          .bind(familyId),
        current: '(SELECT last_print_seq FROM families WHERE id = ?)',
        currentBinding: familyId,
      }
    : {
        bump: db
          .prepare('UPDATE children SET last_print_seq = last_print_seq + 1 WHERE id = ?')
          .bind(childId),
        current: '(SELECT last_print_seq FROM children WHERE id = ?)',
        currentBinding: childId,
      }

const insertImage = (db: D1Database, image: PrintImageRecord) =>
  db
    .prepare('INSERT INTO print_images (id, print_id, page, size) VALUES (?, ?, ?, ?)')
    .bind(image.id, image.print_id, image.page, image.size)

const insertTopic = (db: D1Database, printId: string, topicId: string) =>
  db.prepare('INSERT INTO print_topics (print_id, topic_id) VALUES (?, ?)').bind(printId, topicId)

const selectSeq = (db: D1Database, printId: string) =>
  db.prepare('SELECT seq FROM prints WHERE id = ?').bind(printId)

/** Runs the batch and returns the `seq` read by its last statement (`selectSeq`). */
const batchReturningSeq = async (db: D1Database, statements: D1PreparedStatement[]) => {
  const results = await db.batch<{ seq: number }>(statements)
  return results[results.length - 1].results[0].seq
}

export const createPrintD1Dao = (db: D1Database): PrintDao => ({
  list: async (query) => {
    const conditions = ['p.family_id = ?', 'p.child_id IS ?']
    const bindings: unknown[] = [query.memberId, query.familyId, query.childId]

    if (query.topicIds.length > 0) {
      conditions.push(
        `p.id IN (SELECT print_id FROM print_topics WHERE topic_id IN (${query.topicIds.map(() => '?').join(', ')})
          GROUP BY print_id HAVING COUNT(*) = ?)`,
      )
      bindings.push(...query.topicIds, query.topicIds.length)
    }
    if (query.read !== undefined) {
      conditions.push('COALESCE(s.is_read, 0) = ?')
      bindings.push(query.read ? 1 : 0)
    }
    if (query.responseStatus !== undefined) {
      conditions.push('p.response_status = ?')
      bindings.push(query.responseStatus)
    }
    if (query.miteneStatus !== undefined) {
      conditions.push("COALESCE(s.mitene_status, 'none') = ?")
      bindings.push(query.miteneStatus)
    }
    if (query.sort === 'due') {
      // Past-due prints stay listed only while there's still something to do.
      conditions.push("p.due_on IS NOT NULL AND (p.due_on >= ? OR p.response_status = 'todo')")
      bindings.push(query.today)
    }
    const order =
      query.sort === 'due' ? 'p.due_on ASC, p.created_at DESC' : 'p.created_at DESC, p.id'

    return (
      await db
        .prepare(
          `SELECT ${PRINT_COLUMNS.split(', ')
            .map((column) => `p.${column}`)
            .join(', ')},
             COALESCE(s.is_read, 0) AS is_read,
             COALESCE(s.mitene_status, 'none') AS mitene_status,
             (SELECT name FROM members WHERE id = s.mitene_from) AS mitene_from_name,
             (SELECT json_group_array(topic_id) FROM print_topics WHERE print_id = p.id) AS topic_ids,
             (SELECT COUNT(*) FROM print_images WHERE print_id = p.id) AS image_count,
             (SELECT id FROM print_images WHERE print_id = p.id ORDER BY page LIMIT 1) AS cover_image_id
           FROM prints p
           LEFT JOIN print_member_states s ON s.print_id = p.id AND s.member_id = ?
           WHERE ${conditions.join(' AND ')}
           ORDER BY ${order}`,
        )
        .bind(...bindings)
        .all<PrintListRecord>()
    ).results
  },

  findInFamily: async (familyId, id) =>
    db
      .prepare(`SELECT ${PRINT_COLUMNS} FROM prints WHERE family_id = ? AND id = ?`)
      .bind(familyId, id)
      .first<PrintRecord>(),

  listTopicIds: async (printId) =>
    (
      await db
        .prepare('SELECT topic_id FROM print_topics WHERE print_id = ? ORDER BY rowid')
        .bind(printId)
        .all<{ topic_id: string }>()
    ).results.map((row) => row.topic_id),

  listImages: async (printId) =>
    (
      await db
        .prepare(
          'SELECT id, print_id, page, size FROM print_images WHERE print_id = ? ORDER BY page',
        )
        .bind(printId)
        .all<PrintImageRecord>()
    ).results,

  listMiteneStates: async (printId) =>
    (
      await db
        .prepare(
          `SELECT s.member_id, m.name AS member_name, s.mitene_status, s.mitene_from, f.name AS from_name
           FROM print_member_states s
           JOIN members m ON m.id = s.member_id
           LEFT JOIN members f ON f.id = s.mitene_from
           WHERE s.print_id = ? AND s.mitene_status != 'none'`,
        )
        .bind(printId)
        .all<MiteneStateRecord>()
    ).results,

  markViewed: async (printId, memberId) => {
    await db
      .prepare(
        `INSERT INTO print_member_states (print_id, member_id, is_read) VALUES (?, ?, 1)
         ON CONFLICT (print_id, member_id) DO UPDATE SET
           is_read = 1,
           mitene_status = CASE WHEN mitene_status = 'requested' THEN 'seen' ELSE mitene_status END`,
      )
      .bind(printId, memberId)
      .run()
  },

  requestMitene: async (printId, fromMemberId, memberIds) => {
    await db.batch(
      memberIds.map((memberId) =>
        db
          .prepare(
            `INSERT INTO print_member_states (print_id, member_id, is_read, mitene_status, mitene_from)
             VALUES (?, ?, 0, 'requested', ?)
             ON CONFLICT (print_id, member_id) DO UPDATE SET
               mitene_status = 'requested',
               mitene_from = excluded.mitene_from`,
          )
          .bind(printId, memberId, fromMemberId),
      ),
    )
  },

  listCreatedSince: async (familyId, since) =>
    (
      await db
        .prepare('SELECT child_id, created_at FROM prints WHERE family_id = ? AND created_at >= ?')
        .bind(familyId, since)
        .all<PrintCreatedRecord>()
    ).results,

  storageUsed: async (familyId) =>
    (await db
      .prepare(
        `SELECT COALESCE(SUM(i.size), 0) AS used
         FROM print_images i JOIN prints p ON p.id = i.print_id WHERE p.family_id = ?`,
      )
      .bind(familyId)
      .first<number>('used')) ?? 0,

  findImageInFamily: async (familyId, imageId) =>
    db
      .prepare(
        `SELECT i.id, i.print_id, i.page, i.size
         FROM print_images i JOIN prints p ON p.id = i.print_id
         WHERE p.family_id = ? AND i.id = ?`,
      )
      .bind(familyId, imageId)
      .first<PrintImageRecord>(),

  create: async ({ print, images, topicIds, creatorId, history }) => {
    const seq = nextSeq(db, print.family_id, print.child_id)
    return batchReturningSeq(db, [
      seq.bump,
      db
        .prepare(
          `INSERT INTO prints (${PRINT_COLUMNS}) VALUES (?, ?, ?, ${seq.current}, ?, ?, ?, ?, ?)`,
        )
        .bind(
          print.id,
          print.family_id,
          print.child_id,
          seq.currentBinding,
          print.title,
          print.received_on,
          print.due_on,
          print.response_status,
          print.created_at,
        ),
      ...images.map((image) => insertImage(db, image)),
      ...topicIds.map((topicId) => insertTopic(db, print.id, topicId)),
      db
        .prepare('INSERT INTO print_member_states (print_id, member_id, is_read) VALUES (?, ?, 1)')
        .bind(print.id, creatorId),
      insertHistory(db, history, print.id),
      selectSeq(db, print.id),
    ])
  },

  update: async ({ printId, familyId, changes, topicIds, move, histories }) => {
    const statements: D1PreparedStatement[] = []

    if (move) {
      const seq = nextSeq(db, familyId, move.childId)
      statements.push(
        seq.bump,
        db
          .prepare(`UPDATE prints SET child_id = ?, seq = ${seq.current} WHERE id = ?`)
          .bind(move.childId, seq.currentBinding, printId),
      )
    }
    const columns = CHANGE_COLUMNS.filter((column) => column in changes)
    if (columns.length > 0) {
      statements.push(
        db
          .prepare(
            `UPDATE prints SET ${columns.map((column) => `${column} = ?`).join(', ')} WHERE id = ?`,
          )
          .bind(...columns.map((column) => changes[column] ?? null), printId),
      )
    }
    if (topicIds) {
      statements.push(
        db.prepare('DELETE FROM print_topics WHERE print_id = ?').bind(printId),
        ...topicIds.map((topicId) => insertTopic(db, printId, topicId)),
      )
    }
    statements.push(
      ...histories.map((history) => insertHistory(db, history, printId)),
      selectSeq(db, printId),
    )
    return batchReturningSeq(db, statements)
  },

  replaceImages: async (printId, images, history) => {
    await db.batch([
      db.prepare('DELETE FROM print_images WHERE print_id = ?').bind(printId),
      ...images.map((image) => insertImage(db, image)),
      insertHistory(db, history, printId),
    ])
  },

  delete: async (printId, history) => {
    await db.batch([
      insertHistory(db, history, printId),
      db.prepare('DELETE FROM prints WHERE id = ?').bind(printId),
    ])
  },

  countCreatedBy: async (familyId, cutoff) =>
    (await db
      .prepare('SELECT COUNT(*) AS count FROM prints WHERE family_id = ? AND created_at <= ?')
      .bind(familyId, cutoff)
      .first<number>('count')) ?? 0,

  imageBytesCreatedBy: async (familyId, cutoff) =>
    (await db
      .prepare(
        `SELECT COALESCE(SUM(i.size), 0) AS bytes
         FROM print_images i JOIN prints p ON p.id = i.print_id
         WHERE p.family_id = ? AND p.created_at <= ?`,
      )
      .bind(familyId, cutoff)
      .first<number>('bytes')) ?? 0,

  listImagesCreatedBy: async (familyId, cutoff) =>
    (
      await db
        .prepare(
          `SELECT i.print_id, i.id AS image_id
           FROM print_images i JOIN prints p ON p.id = i.print_id
           WHERE p.family_id = ? AND p.created_at <= ?`,
        )
        .bind(familyId, cutoff)
        .all<PrintImageRefRecord>()
    ).results,

  deleteCreatedBy: async (familyId, cutoff, history) => {
    await db.batch([
      insertHistory(db, history),
      db
        .prepare('DELETE FROM prints WHERE family_id = ? AND created_at <= ?')
        .bind(familyId, cutoff),
    ])
  },
})
