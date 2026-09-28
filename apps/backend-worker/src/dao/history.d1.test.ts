import type { HistoryRecord } from 'backend/src/dao/history.interface.ts'
import { afterAll, beforeAll, expect, test } from 'vite-plus/test'

import { createTestD1 } from './d1.testing.ts'
import { createHistoryD1Dao, insertHistory } from './history.d1.ts'

let testD1: Awaited<ReturnType<typeof createTestD1>>

const row = (id: string, createdAt: number, familyId = 'f1'): HistoryRecord => ({
  id,
  family_id: familyId,
  member_name: '一郎',
  target: 'print',
  action: 'create',
  name: 'はなこ',
  new_name: null,
  print_seq: 1,
  details: null,
  created_at: createdAt,
})

beforeAll(async () => {
  testD1 = await createTestD1()
  const { db } = testD1
  await db.prepare("INSERT INTO families (id, last_accessed_at) VALUES ('f1', 0), ('f2', 0)").run()
  // Inserted out of time order on purpose; h3a/h3b share a timestamp (one batch, like a move).
  await db.batch([
    insertHistory(db, row('h2', 200)),
    insertHistory(db, row('h1', 100)),
    insertHistory(db, row('h3a', 300)),
    insertHistory(db, row('h3b', 300)),
    insertHistory(db, row('h4', 400)),
    insertHistory(db, row('other', 500, 'f2')),
  ])
})

afterAll(async () => {
  await testD1.dispose()
})

test('pages through a family’s history newest first, ties in insertion order reversed', async () => {
  const dao = createHistoryD1Dao(testD1.db)

  const first = await dao.listPage('f1', null, 2)
  expect(first.map((history) => history.id)).toEqual(['h4', 'h3b'])

  const last = first[first.length - 1]
  const second = await dao.listPage('f1', { createdAt: last.created_at, rowid: last.rowid }, 2)
  expect(second.map((history) => history.id)).toEqual(['h3a', 'h2'])

  const tail = second[second.length - 1]
  const third = await dao.listPage('f1', { createdAt: tail.created_at, rowid: tail.rowid }, 2)
  expect(third.map((history) => history.id)).toEqual(['h1'])
})

test('returns rows with every column', async () => {
  const [newest] = await createHistoryD1Dao(testD1.db).listPage('f1', null, 1)

  expect(newest).toEqual({ ...row('h4', 400), rowid: expect.any(Number) })
})
