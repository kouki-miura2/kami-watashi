import { UniqueConstraintError } from 'backend/src/dao/errors.ts'
import type { HistoryRecord } from 'backend/src/dao/history.interface.ts'
import { afterAll, beforeAll, expect, test } from 'vite-plus/test'

import { createChildD1Dao } from './child.d1.ts'
import { createTestD1 } from './d1.testing.ts'

let testD1: Awaited<ReturnType<typeof createTestD1>>

// f1: owner m1, member m2; children c1 はなこ, c2 たろう.
// Prints: p1 (c1, week), p2 (c1, old), p3 (common, week), p4 (c2, week).
beforeAll(async () => {
  testD1 = await createTestD1()
  const { db } = testD1
  await db.batch([
    db.prepare("INSERT INTO families (id, last_accessed_at) VALUES ('f1', 0), ('f2', 0)"),
    db.prepare(
      `INSERT INTO members (id, family_id, name, google_sub, key_hash) VALUES
        ('m1', 'f1', '一郎', 'g1', NULL), ('m2', 'f1', '二郎', NULL, 'k2')`,
    ),
    db.prepare(
      `INSERT INTO children (id, family_id, name, last_print_seq) VALUES
        ('c1', 'f1', 'はなこ', 2), ('c2', 'f1', 'たろう', 1), ('cx', 'f2', 'よそのこ', 0)`,
    ),
    db.prepare("INSERT INTO topics (id, family_id, name) VALUES ('t1', 'f1', 'サッカー')"),
    db.prepare(
      `INSERT INTO prints (id, family_id, child_id, seq, created_at) VALUES
        ('p1', 'f1', 'c1', 1, 2000), ('p2', 'f1', 'c1', 2, 500),
        ('p3', 'f1', NULL, 1, 3000), ('p4', 'f1', 'c2', 1, 1000)`,
    ),
    db.prepare(
      `INSERT INTO print_images (id, print_id, page, size) VALUES
        ('i1', 'p1', 1, 10), ('i2', 'p1', 2, 10), ('i3', 'p2', 1, 10), ('i4', 'p4', 1, 10)`,
    ),
    db.prepare("INSERT INTO print_topics (print_id, topic_id) VALUES ('p1', 't1')"),
    db.prepare(
      `INSERT INTO print_member_states (print_id, member_id, is_read, mitene_status, mitene_from) VALUES
        ('p1', 'm2', 0, 'requested', 'm1'), ('p2', 'm2', 1, 'seen', 'm1'),
        ('p3', 'm2', 0, 'requested', 'm1'), ('p4', 'm1', 0, 'requested', 'm2')`,
    ),
  ])
})

afterAll(async () => {
  await testD1.dispose()
})

const history = (id: string, overrides: Partial<HistoryRecord> = {}): HistoryRecord => ({
  id,
  family_id: 'f1',
  member_name: '一郎',
  target: 'child',
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

test('lists a family’s children in registration order and finds only within the family', async () => {
  const dao = createChildD1Dao(testD1.db)

  expect((await dao.listByFamily('f1')).map((child) => child.name)).toEqual(['はなこ', 'たろう'])
  expect(await dao.findInFamily('f1', 'c1')).toEqual({
    id: 'c1',
    family_id: 'f1',
    name: 'はなこ',
    last_print_seq: 2,
  })
  expect(await dao.findInFamily('f1', 'cx')).toBeNull()
})

test('counts prints registered since a time, per slot (family-common as NULL)', async () => {
  const counts = await createChildD1Dao(testD1.db).countPrintsSince('f1', 1000)

  expect(counts.toSorted((a, b) => String(a.child_id).localeCompare(String(b.child_id)))).toEqual([
    { child_id: 'c1', count: 1 },
    { child_id: 'c2', count: 1 },
    { child_id: null, count: 1 },
  ])
})

test('counts a member’s requested mitene per slot', async () => {
  const dao = createChildD1Dao(testD1.db)

  expect(
    (await dao.countMiteneRequested('m2')).toSorted((a, b) =>
      String(a.child_id).localeCompare(String(b.child_id)),
    ),
  ).toEqual([
    { child_id: 'c1', count: 1 },
    { child_id: null, count: 1 },
  ])
  expect(await dao.countMiteneRequested('m1')).toEqual([{ child_id: 'c2', count: 1 }])
})

test('counts a child’s prints and lists their images', async () => {
  const dao = createChildD1Dao(testD1.db)

  expect(await dao.countPrints('c1')).toBe(2)
  expect(
    (await dao.listImages('c1')).toSorted((a, b) => a.image_id.localeCompare(b.image_id)),
  ).toEqual([
    { print_id: 'p1', image_id: 'i1' },
    { print_id: 'p1', image_id: 'i2' },
    { print_id: 'p2', image_id: 'i3' },
  ])
})

test('create inserts the child and its history row', async () => {
  const dao = createChildD1Dao(testD1.db)

  await dao.create(
    { id: 'c3', family_id: 'f1', name: 'じろう', last_print_seq: 0 },
    history('h-create', { name: 'じろう' }),
  )

  expect(await dao.findInFamily('f1', 'c3')).toMatchObject({ name: 'じろう' })
  expect(await historyRow('h-create')).toMatchObject({ target: 'child', name: 'じろう' })
})

test('a taken name throws UniqueConstraintError and writes no history', async () => {
  const dao = createChildD1Dao(testD1.db)

  await expect(
    dao.create(
      { id: 'c4', family_id: 'f1', name: 'はなこ', last_print_seq: 0 },
      history('h-dup-create'),
    ),
  ).rejects.toBeInstanceOf(UniqueConstraintError)
  await expect(dao.rename('c2', 'はなこ', history('h-dup-rename'))).rejects.toBeInstanceOf(
    UniqueConstraintError,
  )
  expect(await historyRow('h-dup-create')).toBeNull()
  expect(await historyRow('h-dup-rename')).toBeNull()
})

test('rename updates the name with its history row', async () => {
  const dao = createChildD1Dao(testD1.db)

  await dao.rename('c3', 'さぶろう', history('h-rename', { action: 'update' }))

  expect((await dao.findInFamily('f1', 'c3'))?.name).toBe('さぶろう')
  expect(await historyRow('h-rename')).toMatchObject({ action: 'update' })
})

test('delete removes the child with its prints, images, topic links and states', async () => {
  const { db } = testD1
  const count = (sql: string) => db.prepare(sql).first<number>('n')

  await createChildD1Dao(db).delete(
    'c1',
    history('h-delete', { action: 'delete', details: '{"print_count":2}' }),
  )

  expect(await count("SELECT COUNT(*) AS n FROM children WHERE id = 'c1'")).toBe(0)
  expect(await count("SELECT COUNT(*) AS n FROM prints WHERE id IN ('p1', 'p2')")).toBe(0)
  expect(await count("SELECT COUNT(*) AS n FROM print_images WHERE print_id IN ('p1', 'p2')")).toBe(
    0,
  )
  expect(await count("SELECT COUNT(*) AS n FROM print_topics WHERE print_id = 'p1'")).toBe(0)
  expect(
    await count("SELECT COUNT(*) AS n FROM print_member_states WHERE print_id IN ('p1', 'p2')"),
  ).toBe(0)
  // Other slots are untouched.
  expect(await count("SELECT COUNT(*) AS n FROM prints WHERE id IN ('p3', 'p4')")).toBe(2)
  expect(await historyRow('h-delete')).toMatchObject({ details: '{"print_count":2}' })
})
