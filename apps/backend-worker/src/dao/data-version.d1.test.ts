// `families.data_version` and the indexes of migrations/0002_data_version.sql: the triggers bump
// the version on every change a member's screens show, and on nothing else.
import { afterAll, beforeAll, expect, test } from 'vite-plus/test'

import { createChildD1Dao } from './child.d1.ts'
import { createTestD1 } from './d1.testing.ts'
import { createFamilyD1Dao } from './family.d1.ts'
import { createMemberD1Dao } from './member.d1.ts'
import { createPrintD1Dao } from './print.d1.ts'

let testD1: Awaited<ReturnType<typeof createTestD1>>

beforeAll(async () => {
  testD1 = await createTestD1()
  const { db } = testD1
  await db.batch([
    db.prepare("INSERT INTO families (id, last_accessed_at) VALUES ('f1', 0), ('f2', 0)"),
    db.prepare(
      `INSERT INTO members (id, family_id, name, google_sub, key_hash) VALUES
        ('m1', 'f1', '一郎', 'g1', NULL), ('m2', 'f1', '二郎', NULL, 'k2'), ('mx', 'f2', 'よそ', 'gx', NULL)`,
    ),
    db.prepare(
      "INSERT INTO prints (id, family_id, child_id, seq, created_at) VALUES ('p1', 'f1', NULL, 1, 0)",
    ),
  ])
})

afterAll(async () => {
  await testD1.dispose()
})

const versionOf = async (familyId: string) =>
  testD1.db
    .prepare('SELECT data_version FROM families WHERE id = ?')
    .bind(familyId)
    .first<number>('data_version')

/** How much `write` bumped f1's data version (and that it left f2's alone). */
const bumpsOf = async (write: () => Promise<unknown>) => {
  const [before, otherBefore] = [await versionOf('f1'), await versionOf('f2')]
  await write()
  expect(await versionOf('f2')).toBe(otherBefore)
  return (await versionOf('f1'))! - before!
}

test('a history row bumps its family’s version', async () => {
  const child = { id: 'c1', family_id: 'f1', name: 'はなこ', last_print_seq: 0 }
  const history = {
    id: 'h1',
    family_id: 'f1',
    member_name: '一郎',
    target: 'child' as const,
    action: 'create' as const,
    name: 'はなこ',
    new_name: null,
    print_seq: null,
    details: null,
    created_at: 0,
  }

  expect(await bumpsOf(() => createChildD1Dao(testD1.db).create(child, history))).toBe(1)
})

test('opening a print bumps the version only when it changes a state', async () => {
  const dao = createPrintD1Dao(testD1.db)

  expect(await bumpsOf(() => dao.markViewed('p1', 'm2'))).toBe(1)
  expect(await bumpsOf(() => dao.markViewed('p1', 'm2'))).toBe(0)
})

test('a mitene bumps the version, and turns into a bump again when seen', async () => {
  const dao = createPrintD1Dao(testD1.db)

  expect(await bumpsOf(() => dao.requestMitene('p1', 'm1', ['m2']))).toBe(1)
  // The same mitene again changes nothing.
  expect(await bumpsOf(() => dao.requestMitene('p1', 'm1', ['m2']))).toBe(0)
  expect(await bumpsOf(() => dao.markViewed('p1', 'm2'))).toBe(1)
})

test('launching the app and agreeing to the terms leave the version alone', async () => {
  expect(await bumpsOf(() => createFamilyD1Dao(testD1.db).touch('f1', 1))).toBe(0)
  expect(await bumpsOf(() => createMemberD1Dao(testD1.db).agreeTerms('m1', 'v2', 1))).toBe(0)
})

test('queries by child, or by family and registration time, use an index', async () => {
  const planOf = async (sql: string) =>
    (await testD1.db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all<{ detail: string }>()).results
      .map((row) => row.detail)
      .join('\n')

  expect(await planOf("SELECT COUNT(*) FROM prints WHERE child_id = 'c1'")).toMatch(
    /USING (COVERING )?INDEX prints_by_child/,
  )
  expect(
    await planOf("SELECT child_id FROM prints WHERE family_id = 'f1' AND created_at >= 0"),
  ).toMatch(/USING (COVERING )?INDEX prints_by_family_created/)
})
