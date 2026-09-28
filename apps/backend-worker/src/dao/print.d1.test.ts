import type { HistoryRecord } from 'backend/src/dao/history.interface.ts'
import type { NewPrintInput, PrintListQuery } from 'backend/src/dao/print.interface.ts'
import { afterAll, beforeAll, expect, test } from 'vite-plus/test'

import { createTestD1 } from './d1.testing.ts'
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
      `INSERT INTO children (id, family_id, name) VALUES
        ('c1', 'f1', 'はなこ'), ('c2', 'f1', 'たろう'), ('c3', 'f1', 'じろう'), ('cx', 'f2', 'よそのこ')`,
    ),
    db.prepare(
      `INSERT INTO topics (id, family_id, name) VALUES
        ('t1', 'f1', '試合'), ('t2', 'f1', 'サッカー'), ('t3', 'f1', '遠足')`,
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
  target: 'print',
  action: 'create',
  name: 'はなこ',
  new_name: null,
  print_seq: null,
  details: null,
  created_at: 0,
  ...overrides,
})

const historyRow = (id: string) =>
  testD1.db.prepare('SELECT * FROM histories WHERE id = ?').bind(id).first<HistoryRecord>()

const newPrint = (
  id: string,
  childId: string | null,
  overrides: Partial<NewPrintInput['print']> = {},
  extra: Partial<Omit<NewPrintInput, 'print'>> = {},
): NewPrintInput => ({
  print: {
    id,
    family_id: 'f1',
    child_id: childId,
    title: null,
    received_on: null,
    due_on: null,
    response_status: 'none',
    created_at: 1000,
    ...overrides,
  },
  images: [{ id: `${id}-i1`, print_id: id, page: 1, size: 100 }],
  topicIds: [],
  creatorId: 'm1',
  history: history(`h-${id}`, { name: childId === null ? '家族共通' : 'はなこ' }),
  ...extra,
})

test('create numbers prints per slot, never reusing a number, and records it in history', async () => {
  const dao = createPrintD1Dao(testD1.db)

  expect(await dao.create(newPrint('s1', 'c3'))).toBe(1)
  expect(await dao.create(newPrint('s2', 'c3'))).toBe(2)
  expect(await dao.create(newPrint('s3', null))).toBe(1)

  await dao.delete('s2', history('h-s2-delete', { action: 'delete', print_seq: 2 }))
  expect(await dao.create(newPrint('s4', 'c3'))).toBe(3)

  expect(await historyRow('h-s4')).toMatchObject({ print_seq: 3, action: 'create' })
  expect(await historyRow('h-s3')).toMatchObject({ print_seq: 1, name: '家族共通' })
  expect(await historyRow('h-s2-delete')).toMatchObject({ print_seq: 2, action: 'delete' })
})

test('create stores images, topics, and marks the print read by its creator', async () => {
  const dao = createPrintD1Dao(testD1.db)

  await dao.create(
    newPrint(
      's5',
      'c3',
      {},
      {
        images: [
          { id: 's5-i2', print_id: 's5', page: 2, size: 20 },
          { id: 's5-i1', print_id: 's5', page: 1, size: 10 },
        ],
        topicIds: ['t1', 't2'],
      },
    ),
  )

  expect((await dao.listImages('s5')).map((image) => image.id)).toEqual(['s5-i1', 's5-i2'])
  expect(await dao.listTopicIds('s5')).toEqual(['t1', 't2'])
  const [item] = (await dao.list(listQuery({ childId: 'c3', memberId: 'm1' }))).filter(
    (row) => row.id === 's5',
  )
  expect(item).toMatchObject({ is_read: 1, image_count: 2, cover_image_id: 's5-i1' })
  expect(JSON.parse(item.topic_ids).toSorted()).toEqual(['t1', 't2'])
})

const listQuery = (overrides: Partial<PrintListQuery> = {}): PrintListQuery => ({
  familyId: 'f1',
  childId: 'c1',
  memberId: 'm2',
  sort: 'created',
  today: '2026-09-28',
  topicIds: [],
  ...overrides,
})

test('list filters and sorts one slot', async () => {
  const dao = createPrintD1Dao(testD1.db)
  const add = (id: string, print: Partial<NewPrintInput['print']>, topicIds: string[] = []) =>
    dao.create(newPrint(id, 'c1', print, { topicIds }))
  await add('l1', { created_at: 1, due_on: '2026-10-05' }, ['t1', 't2'])
  await add('l2', { created_at: 2, due_on: '2026-09-01', response_status: 'todo' }, ['t1'])
  await add('l3', { created_at: 3, due_on: '2026-09-01', response_status: 'done' })
  await add('l4', { created_at: 4, due_on: '2026-09-28' })
  await add('l5', { created_at: 5 }, ['t2'])
  await dao.markViewed('l5', 'm2')
  await testD1.db
    .prepare(
      "INSERT INTO print_member_states (print_id, member_id, mitene_status, mitene_from) VALUES ('l1', 'm2', 'requested', 'm1')",
    )
    .run()
  const ids = async (overrides: Partial<PrintListQuery>) =>
    (await dao.list(listQuery(overrides))).map((row) => row.id)

  expect(await ids({})).toEqual(['l5', 'l4', 'l3', 'l2', 'l1'])
  // Due order: past-due only while todo; no due date excluded; earliest first.
  expect(await ids({ sort: 'due' })).toEqual(['l2', 'l4', 'l1'])
  expect(await ids({ topicIds: ['t1', 't2'] })).toEqual(['l1'])
  expect(await ids({ topicIds: ['t1'] })).toEqual(['l2', 'l1'])
  expect(await ids({ read: true })).toEqual(['l5'])
  expect(await ids({ read: false })).toEqual(['l4', 'l3', 'l2', 'l1'])
  expect(await ids({ responseStatus: 'todo' })).toEqual(['l2'])
  expect(await ids({ miteneStatus: 'requested' })).toEqual(['l1'])
  expect(await ids({ miteneStatus: 'none' })).toEqual(['l5', 'l4', 'l3', 'l2'])
  // The sender's name comes with a mitene, for the list's 「見てね・二郎」.
  const [requested] = await dao.list(listQuery({ miteneStatus: 'requested' }))
  expect(requested?.mitene_from_name).toEqual(expect.any(String))
  const [none] = await dao.list(listQuery({ miteneStatus: 'none' }))
  expect(none?.mitene_from_name).toBeNull()
  // Another family's view of the same child id sees nothing.
  expect(await ids({ familyId: 'f2' })).toEqual([])
})

test('markViewed marks read and turns requested into seen, leaving other states alone', async () => {
  const { db } = testD1
  const dao = createPrintD1Dao(db)
  await dao.create(newPrint('v1', 'c2'))
  await db
    .prepare(
      "INSERT INTO print_member_states (print_id, member_id, is_read, mitene_status, mitene_from) VALUES ('v1', 'm2', 0, 'requested', 'm1')",
    )
    .run()

  await dao.markViewed('v1', 'm2')
  await dao.markViewed('v1', 'm2')

  expect(await dao.listMiteneStates('v1')).toEqual([
    {
      member_id: 'm2',
      member_name: '二郎',
      mitene_status: 'seen',
      mitene_from: 'm1',
      from_name: '一郎',
    },
  ])
  const state = await db
    .prepare("SELECT is_read FROM print_member_states WHERE print_id = 'v1' AND member_id = 'm2'")
    .first('is_read')
  expect(state).toBe(1)
})

test('update changes only the given columns, clears nulls and replaces topics', async () => {
  const dao = createPrintD1Dao(testD1.db)
  await dao.create(
    newPrint('u1', 'c2', { title: '遠足', due_on: '2026-10-03' }, { topicIds: ['t1'] }),
  )

  const seq = await dao.update({
    printId: 'u1',
    familyId: 'f1',
    changes: { title: null, response_status: 'done' },
    topicIds: ['t2', 't3'],
    histories: [history('h-u1-update', { action: 'update', print_seq: 2 })],
  })

  expect(await dao.findInFamily('f1', 'u1')).toMatchObject({
    title: null,
    due_on: '2026-10-03',
    response_status: 'done',
    seq,
  })
  expect(await dao.listTopicIds('u1')).toEqual(['t2', 't3'])
  expect(await historyRow('h-u1-update')).toMatchObject({ print_seq: 2 })
})

test('update moving a print takes the new slot’s next number and records both halves', async () => {
  const dao = createPrintD1Dao(testD1.db)
  await dao.create(newPrint('mv1', 'c2', { created_at: 777 }))
  const before = await dao.findInFamily('f1', 'mv1')

  const seq = await dao.update({
    printId: 'mv1',
    familyId: 'f1',
    changes: {},
    move: { childId: null },
    histories: [
      history('h-mv-delete', { action: 'delete', print_seq: before?.seq ?? 0 }),
      history('h-mv-create', { name: '家族共通' }),
    ],
  })

  // The family-common slot had 1 print (s3), so this one is its 2nd.
  expect(seq).toBe(2)
  expect(await dao.findInFamily('f1', 'mv1')).toMatchObject({
    child_id: null,
    seq: 2,
    created_at: 777,
  })
  expect(await historyRow('h-mv-delete')).toMatchObject({ print_seq: before?.seq })
  expect(await historyRow('h-mv-create')).toMatchObject({ print_seq: 2, name: '家族共通' })
  expect((await dao.listImages('mv1')).map((image) => image.id)).toEqual(['mv1-i1'])
})

test('replaceImages swaps all pages and counts toward storage', async () => {
  const dao = createPrintD1Dao(testD1.db)
  await dao.create(newPrint('r1', 'c2'))
  const usedBefore = await dao.storageUsed('f1')

  await dao.replaceImages(
    'r1',
    [
      { id: 'r1-n1', print_id: 'r1', page: 1, size: 300 },
      { id: 'r1-n2', print_id: 'r1', page: 2, size: 300 },
    ],
    history('h-r1-replace', { action: 'update', print_seq: 1, details: '{"image_count":2}' }),
  )

  expect((await dao.listImages('r1')).map((image) => image.id)).toEqual(['r1-n1', 'r1-n2'])
  expect(await dao.storageUsed('f1')).toBe(usedBefore - 100 + 600)
  expect(await dao.storageUsed('f2')).toBe(0)
  expect(await dao.findImageInFamily('f1', 'r1-n1')).toMatchObject({ print_id: 'r1' })
  expect(await dao.findImageInFamily('f2', 'r1-n1')).toBeNull()
  expect(await dao.findImageInFamily('f1', 'r1-i1')).toBeNull()
})

test('bulk deletion counts, lists and deletes prints registered by the cutoff', async () => {
  const { db } = testD1
  const dao = createPrintD1Dao(db)
  const total = await db
    .prepare("SELECT COUNT(*) AS n FROM prints WHERE family_id = 'f1'")
    .first<number>('n')
  // Everything so far was created at or before 1000.
  await dao.create(newPrint('new1', 'c2', { created_at: 5000 }))

  expect(await dao.countCreatedBy('f1', 1000)).toBe(total)
  expect((await dao.listImagesCreatedBy('f1', 1000)).length).toBeGreaterThan(0)
  // The photo bytes of exactly those prints: everything used so far, but not `new1`'s.
  const oldBytes = await db
    .prepare(
      "SELECT SUM(i.size) AS bytes FROM print_images i JOIN prints p ON p.id = i.print_id WHERE p.family_id = 'f1' AND p.id != 'new1'",
    )
    .first<number>('bytes')
  expect(await dao.imageBytesCreatedBy('f1', 1000)).toBe(oldBytes)
  expect(await dao.imageBytesCreatedBy('f2', 1000)).toBe(0)

  await dao.deleteCreatedBy(
    'f1',
    1000,
    history('h-bulk', { action: 'bulk_delete', name: null, details: '{"print_count":1}' }),
  )

  expect((await db.prepare("SELECT id FROM prints WHERE family_id = 'f1'").all()).results).toEqual([
    { id: 'new1' },
  ])
  expect(await db.prepare('SELECT COUNT(*) AS n FROM print_images').first('n')).toBe(1)
  expect(await historyRow('h-bulk')).toMatchObject({ action: 'bulk_delete', print_seq: null })
})

test('requestMitene sets requested from the sender, overwriting an earlier mitene and keeping read state', async () => {
  const { db } = testD1
  const dao = createPrintD1Dao(db)
  await dao.create(newPrint('mt1', 'c2'))
  await dao.markViewed('mt1', 'm2')
  await db
    .prepare(
      "UPDATE print_member_states SET mitene_status = 'seen', mitene_from = 'm1' WHERE print_id = 'mt1' AND member_id = 'm2'",
    )
    .run()

  await dao.requestMitene('mt1', 'm1', ['m2'])
  await dao.requestMitene('mt1', 'm2', ['m1'])

  const states = (
    await db
      .prepare(
        "SELECT member_id, is_read, mitene_status, mitene_from FROM print_member_states WHERE print_id = 'mt1' ORDER BY member_id",
      )
      .all()
  ).results
  expect(states).toEqual([
    // The creator had read it; receiving mitene doesn't make it unread.
    { member_id: 'm1', is_read: 1, mitene_status: 'requested', mitene_from: 'm2' },
    { member_id: 'm2', is_read: 1, mitene_status: 'requested', mitene_from: 'm1' },
  ])
})

test('listCreatedSince returns slot and time of the family’s prints from `since`', async () => {
  const dao = createPrintD1Dao(testD1.db)
  await dao.create(newPrint('st1', 'c2', { created_at: 9000 }))
  await dao.create(newPrint('st2', null, { created_at: 9500 }))

  expect(
    (await dao.listCreatedSince('f1', 9000)).toSorted((a, b) => a.created_at - b.created_at),
  ).toEqual([
    { child_id: 'c2', created_at: 9000 },
    { child_id: null, created_at: 9500 },
  ])
  expect(await dao.listCreatedSince('f2', 0)).toEqual([])
})
