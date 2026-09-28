import { UniqueConstraintError } from 'backend/src/dao/errors.ts'
import { afterAll, beforeAll, expect, test } from 'vite-plus/test'

import { createTestD1 } from './d1.testing.ts'
import { createMemberD1Dao } from './member.d1.ts'

let testD1: Awaited<ReturnType<typeof createTestD1>>

beforeAll(async () => {
  testD1 = await createTestD1()
  await testD1.db.batch([
    testD1.db.prepare("INSERT INTO families (id, last_accessed_at) VALUES ('f1', 0), ('f2', 0)"),
    testD1.db.prepare(
      `INSERT INTO members (id, family_id, name, google_sub, key_hash, terms_version, terms_agreed_at) VALUES
        ('owner', 'f1', '一郎', 'google-1', NULL, 'v1', 1),
        ('invited', 'f1', '二郎', NULL, 'hash-2', 'v1', 2),
        ('other', 'f2', '三郎', 'google-3', NULL, 'v1', 3)`,
    ),
  ])
})

afterAll(async () => {
  await testD1.dispose()
})

test('finds a member by id, key hash, or google sub', async () => {
  const dao = createMemberD1Dao(testD1.db)

  expect(await dao.findById('owner')).toEqual({
    id: 'owner',
    family_id: 'f1',
    name: '一郎',
    google_sub: 'google-1',
    key_hash: null,
    terms_version: 'v1',
    terms_agreed_at: 1,
  })
  expect((await dao.findByKeyHash('hash-2'))?.id).toBe('invited')
  expect((await dao.findByGoogleSub('google-3'))?.id).toBe('other')
})

test('returns null for unknown values', async () => {
  const dao = createMemberD1Dao(testD1.db)

  expect(await dao.findById('missing')).toBeNull()
  expect(await dao.findByKeyHash('missing')).toBeNull()
  expect(await dao.findByGoogleSub('missing')).toBeNull()
})

test('lists only the given family’s members', async () => {
  const members = await createMemberD1Dao(testD1.db).listByFamily('f1')

  expect(members.map((member) => member.id).toSorted()).toEqual(['invited', 'owner'])
})

test('enforces unique display names within a family', async () => {
  await expect(
    testD1.db
      .prepare(
        "INSERT INTO members (id, family_id, name, google_sub) VALUES ('dup', 'f1', '一郎', 'google-9')",
      )
      .run(),
  ).rejects.toThrow(/UNIQUE/)
})

const invitedInput = (id: string, name: string, familyId = 'f2') => ({
  id,
  familyId,
  name,
  keyHash: `hash-${id}`,
  termsVersion: 'v1',
  now: 9000,
  maxMembers: 3,
})

test('createInvited adds a member while there is room and records the family access', async () => {
  const dao = createMemberD1Dao(testD1.db)

  expect(await dao.createInvited(invitedInput('new-1', '四郎'))).toBe(true)

  expect(await dao.findByKeyHash('hash-new-1')).toMatchObject({
    id: 'new-1',
    family_id: 'f2',
    google_sub: null,
    terms_version: 'v1',
    terms_agreed_at: 9000,
  })
  expect(
    await testD1.db
      .prepare('SELECT last_accessed_at FROM families WHERE id = ?')
      .bind('f2')
      .first('last_accessed_at'),
  ).toBe(9000)
})

test('createInvited inserts nothing once the family is full', async () => {
  const dao = createMemberD1Dao(testD1.db)
  // f1 already has 2 members; the third fills it.
  expect(await dao.createInvited(invitedInput('new-2', '五郎', 'f1'))).toBe(true)

  expect(await dao.createInvited(invitedInput('new-3', '六郎', 'f1'))).toBe(false)
  expect(await dao.findById('new-3')).toBeNull()
})

test('createInvited throws UniqueConstraintError for a name taken in the family', async () => {
  await expect(
    createMemberD1Dao(testD1.db).createInvited(invitedInput('new-4', '三郎')),
  ).rejects.toBeInstanceOf(UniqueConstraintError)
})

test('rename updates the name and writes the history row in one batch', async () => {
  const dao = createMemberD1Dao(testD1.db)
  const history = {
    id: 'h1',
    family_id: 'f2',
    member_name: '三郎',
    target: 'member' as const,
    action: 'update' as const,
    name: '三郎',
    new_name: '三朗',
    print_seq: null,
    details: null,
    created_at: 42,
  }

  await dao.rename('other', '三朗', history)

  expect((await dao.findById('other'))?.name).toBe('三朗')
  expect(
    await testD1.db.prepare('SELECT * FROM histories WHERE id = ?').bind('h1').first(),
  ).toEqual(history)
})

test('rename to a taken name throws UniqueConstraintError and writes no history', async () => {
  const dao = createMemberD1Dao(testD1.db)

  await expect(
    dao.rename('invited', '一郎', {
      id: 'h2',
      family_id: 'f1',
      member_name: '二郎',
      target: 'member',
      action: 'update',
      name: '二郎',
      new_name: '一郎',
      print_seq: null,
      details: null,
      created_at: 43,
    }),
  ).rejects.toBeInstanceOf(UniqueConstraintError)
  expect(await testD1.db.prepare('SELECT id FROM histories WHERE id = ?').bind('h2').first()).toBe(
    null,
  )
})

test('agreeTerms records the version and time', async () => {
  const dao = createMemberD1Dao(testD1.db)

  await dao.agreeTerms('invited', 'v2', 777)

  expect(await dao.findById('invited')).toMatchObject({ terms_version: 'v2', terms_agreed_at: 777 })
})

test('delete withdraws the mitene the member sent and removes their own states', async () => {
  const { db } = testD1
  await db.batch([
    db.prepare(
      `INSERT INTO members (id, family_id, name, google_sub, key_hash) VALUES
        ('d-owner', 'f2', 'オーナー', 'g-d', NULL), ('d-leaver', 'f2', '去る人', NULL, 'k-d'),
        ('d-stayer', 'f2', '残る人', NULL, 'k-s')`,
    ),
    db.prepare(
      "INSERT INTO prints (id, family_id, child_id, seq, created_at) VALUES ('d-p1', 'f2', NULL, 1, 0)",
    ),
    db.prepare(
      `INSERT INTO print_member_states (print_id, member_id, is_read, mitene_status, mitene_from) VALUES
        ('d-p1', 'd-stayer', 1, 'requested', 'd-leaver'),
        ('d-p1', 'd-owner', 0, 'seen', 'd-leaver'),
        ('d-p1', 'd-leaver', 1, 'requested', 'd-owner')`,
    ),
  ])

  await createMemberD1Dao(db).delete('d-leaver')

  expect(await createMemberD1Dao(db).findById('d-leaver')).toBeNull()
  expect(
    (
      await db
        .prepare(
          "SELECT member_id, is_read, mitene_status, mitene_from FROM print_member_states WHERE print_id = 'd-p1' ORDER BY member_id",
        )
        .all()
    ).results,
  ).toEqual([
    { member_id: 'd-owner', is_read: 0, mitene_status: 'none', mitene_from: null },
    { member_id: 'd-stayer', is_read: 1, mitene_status: 'none', mitene_from: null },
  ])
})
