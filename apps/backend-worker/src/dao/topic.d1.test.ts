import { UniqueConstraintError } from 'backend/src/dao/errors.ts'
import type { HistoryRecord } from 'backend/src/dao/history.interface.ts'
import { afterAll, beforeAll, expect, test } from 'vite-plus/test'

import { createTestD1 } from './d1.testing.ts'
import { createTopicD1Dao } from './topic.d1.ts'

let testD1: Awaited<ReturnType<typeof createTestD1>>

beforeAll(async () => {
  testD1 = await createTestD1()
  const { db } = testD1
  await db.batch([
    db.prepare("INSERT INTO families (id, last_accessed_at) VALUES ('f1', 0), ('f2', 0)"),
    db.prepare(
      `INSERT INTO topics (id, family_id, name) VALUES
        ('t1', 'f1', 'サッカー'), ('t2', 'f1', '試合'), ('tx', 'f2', 'よそ')`,
    ),
    db.prepare(
      "INSERT INTO prints (id, family_id, child_id, seq, created_at) VALUES ('p1', 'f1', NULL, 1, 0)",
    ),
    db.prepare("INSERT INTO print_topics (print_id, topic_id) VALUES ('p1', 't1'), ('p1', 't2')"),
  ])
})

afterAll(async () => {
  await testD1.dispose()
})

const history = (id: string, overrides: Partial<HistoryRecord> = {}): HistoryRecord => ({
  id,
  family_id: 'f1',
  member_name: '一郎',
  target: 'topic',
  action: 'create',
  name: null,
  new_name: null,
  print_seq: null,
  details: null,
  created_at: 0,
  ...overrides,
})

const historyRow = (id: string) =>
  testD1.db.prepare('SELECT * FROM histories WHERE id = ?').bind(id).first()

test('lists and finds topics only within the family', async () => {
  const dao = createTopicD1Dao(testD1.db)

  expect((await dao.listByFamily('f1')).map((topic) => topic.id).toSorted()).toEqual(['t1', 't2'])
  expect(await dao.findInFamily('f1', 't1')).toEqual({
    id: 't1',
    family_id: 'f1',
    name: 'サッカー',
  })
  expect(await dao.findInFamily('f1', 'tx')).toBeNull()
})

test('create and rename write their history rows; a taken name throws', async () => {
  const dao = createTopicD1Dao(testD1.db)

  await dao.create({ id: 't3', family_id: 'f1', name: '遠足' }, history('h1'))
  await dao.rename('t3', '遠足・校外学習', history('h2', { action: 'update' }))
  await expect(dao.rename('t3', '試合', history('h3'))).rejects.toBeInstanceOf(
    UniqueConstraintError,
  )

  expect((await dao.findInFamily('f1', 't3'))?.name).toBe('遠足・校外学習')
  expect(await historyRow('h1')).not.toBeNull()
  expect(await historyRow('h2')).not.toBeNull()
  expect(await historyRow('h3')).toBeNull()
})

test('delete takes the topic off every print and records it', async () => {
  const { db } = testD1

  await createTopicD1Dao(db).delete('t1', history('h4', { action: 'delete', name: 'サッカー' }))

  expect(
    (await db.prepare("SELECT topic_id FROM print_topics WHERE print_id = 'p1'").all()).results,
  ).toEqual([{ topic_id: 't2' }])
  expect(await historyRow('h4')).toMatchObject({ action: 'delete', name: 'サッカー' })
})
