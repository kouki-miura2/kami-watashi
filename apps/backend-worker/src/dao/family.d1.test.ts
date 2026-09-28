import { UniqueConstraintError } from 'backend/src/dao/errors.ts'
import { afterAll, beforeAll, expect, test } from 'vite-plus/test'

import { createTestD1 } from './d1.testing.ts'
import { createFamilyD1Dao } from './family.d1.ts'

let testD1: Awaited<ReturnType<typeof createTestD1>>

beforeAll(async () => {
  testD1 = await createTestD1()
})

afterAll(async () => {
  await testD1.dispose()
})

const owner = (familyId: string, googleSub: string, now = 1000) => ({
  familyId,
  ownerId: `${familyId}-owner`,
  ownerName: '一郎',
  googleSub,
  termsVersion: 'v1',
  now,
})

test('createWithOwner inserts the family and its owner', async () => {
  await createFamilyD1Dao(testD1.db).createWithOwner(owner('f1', 'google-1'))

  expect(await testD1.db.prepare('SELECT * FROM families WHERE id = ?').bind('f1').first()).toEqual(
    { id: 'f1', last_accessed_at: 1000, last_print_seq: 0 },
  )
  expect(
    await testD1.db.prepare('SELECT * FROM members WHERE family_id = ?').bind('f1').first(),
  ).toEqual({
    id: 'f1-owner',
    family_id: 'f1',
    name: '一郎',
    google_sub: 'google-1',
    key_hash: null,
    terms_version: 'v1',
    terms_agreed_at: 1000,
  })
})

test('createWithOwner is atomic: a duplicate google_sub leaves no orphan family', async () => {
  const dao = createFamilyD1Dao(testD1.db)
  await dao.createWithOwner(owner('f2', 'google-2'))

  await expect(dao.createWithOwner(owner('f3', 'google-2'))).rejects.toBeInstanceOf(
    UniqueConstraintError,
  )
  expect(await testD1.db.prepare('SELECT id FROM families WHERE id = ?').bind('f3').first()).toBe(
    null,
  )
})

test('touch updates last_accessed_at', async () => {
  const dao = createFamilyD1Dao(testD1.db)
  await dao.createWithOwner(owner('f4', 'google-4'))

  await dao.touch('f4', 5000)

  expect(
    await testD1.db
      .prepare('SELECT last_accessed_at FROM families WHERE id = ?')
      .bind('f4')
      .first('last_accessed_at'),
  ).toBe(5000)
})

test('deleting a family cascades to its members (foreign keys are enforced)', async () => {
  await createFamilyD1Dao(testD1.db).createWithOwner(owner('f5', 'google-5'))

  await testD1.db.prepare('DELETE FROM families WHERE id = ?').bind('f5').run()

  expect(
    await testD1.db.prepare('SELECT id FROM members WHERE family_id = ?').bind('f5').first(),
  ).toBe(null)
})

test('listInactive returns families not launched since the cutoff, oldest first, up to the limit', async () => {
  const dao = createFamilyD1Dao(testD1.db)
  await dao.createWithOwner(owner('in-a', 'google-in-a', 300))
  await dao.createWithOwner(owner('in-b', 'google-in-b', 100))
  await dao.createWithOwner(owner('in-c', 'google-in-c', 200))
  await dao.createWithOwner(owner('active', 'google-active', 999_999))

  const inactive = await dao.listInactive(400, 10)

  expect(inactive.filter((id) => id.startsWith('in-'))).toEqual(['in-b', 'in-c', 'in-a'])
  expect(inactive).not.toContain('active')
  expect(await dao.listInactive(400, 1)).toHaveLength(1)
})

test('delete removes the family with everything under it', async () => {
  const { db } = testD1
  await createFamilyD1Dao(db).createWithOwner(owner('gone', 'google-gone'))
  await db.batch([
    db.prepare("INSERT INTO children (id, family_id, name) VALUES ('gone-c', 'gone', 'はなこ')"),
    db.prepare("INSERT INTO topics (id, family_id, name) VALUES ('gone-t', 'gone', '試合')"),
    db.prepare(
      "INSERT INTO prints (id, family_id, child_id, seq, created_at) VALUES ('gone-p', 'gone', 'gone-c', 1, 0)",
    ),
    db.prepare(
      "INSERT INTO print_images (id, print_id, page, size) VALUES ('gone-i', 'gone-p', 1, 1)",
    ),
    db.prepare("INSERT INTO print_topics (print_id, topic_id) VALUES ('gone-p', 'gone-t')"),
    db.prepare(
      "INSERT INTO print_member_states (print_id, member_id, is_read) VALUES ('gone-p', 'gone-owner', 1)",
    ),
    db.prepare(
      "INSERT INTO histories (id, family_id, member_name, target, action, created_at) VALUES ('gone-h', 'gone', '一郎', 'child', 'create', 0)",
    ),
  ])

  await createFamilyD1Dao(db).delete('gone')

  const remaining = await db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM families WHERE id = 'gone') +
        (SELECT COUNT(*) FROM members WHERE family_id = 'gone') +
        (SELECT COUNT(*) FROM children WHERE family_id = 'gone') +
        (SELECT COUNT(*) FROM topics WHERE family_id = 'gone') +
        (SELECT COUNT(*) FROM prints WHERE family_id = 'gone') +
        (SELECT COUNT(*) FROM print_images WHERE id = 'gone-i') +
        (SELECT COUNT(*) FROM print_topics WHERE print_id = 'gone-p') +
        (SELECT COUNT(*) FROM print_member_states WHERE print_id = 'gone-p') +
        (SELECT COUNT(*) FROM histories WHERE family_id = 'gone') AS n`,
    )
    .first('n')
  expect(remaining).toBe(0)
})
