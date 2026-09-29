import { LIMITS } from 'utils'
import { expect, test, vi } from 'vite-plus/test'

import { AppError } from '../service/errors.ts'
import type { MiteneService } from '../service/mitene.service.ts'
import type { PrintService } from '../service/print.service.ts'
import { authorized, createTestApp, invitedUser } from '../testing.ts'

const jpegFile = (name = 'page.jpg') =>
  new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], name, { type: 'image/jpeg' })

const form = (fields: Record<string, string | File | (string | File)[]>) => {
  const body = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    for (const item of Array.isArray(value) ? value : [value]) body.append(key, item)
  }
  return body
}

const json = (method: string, body: unknown) => ({
  method,
  headers: { ...authorized.headers, 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

const ref = { id: 'p1', childId: 'c1', seq: 3 }

test('GET /prints maps the query to a list filter', async () => {
  const list = vi.fn<PrintService['list']>(async () => [])
  const app = createTestApp({ user: invitedUser, services: { printService: { list } } })

  const res = await app.request(
    '/prints?child=common&sort=due&topicIds=t1,t2&read=unread&response=todo&mitene=requested',
    authorized,
  )

  expect(res.status).toBe(200)
  expect(list).toHaveBeenCalledWith(invitedUser, {
    childId: null,
    sort: 'due',
    topicIds: ['t1', 't2'],
    read: false,
    responseStatus: 'todo',
    miteneStatus: 'requested',
  })
})

test('GET /prints defaults to newest first with no filters, and requires the slot', async () => {
  const list = vi.fn<PrintService['list']>(async () => [])
  const app = createTestApp({ services: { printService: { list } } })

  await app.request('/prints?child=c1', authorized)
  expect(list).toHaveBeenCalledWith(expect.anything(), {
    childId: 'c1',
    sort: 'created',
    topicIds: [],
    read: undefined,
    responseStatus: undefined,
    miteneStatus: undefined,
  })
  expect((await app.request('/prints', authorized)).status).toBe(400)
})

test('POST /prints registers a print from a multipart form', async () => {
  const create = vi.fn<PrintService['create']>(async () => ref)
  const app = createTestApp({ user: invitedUser, services: { printService: { create } } })

  const res = await app.request('/prints', {
    method: 'POST',
    ...authorized,
    body: form({
      childId: 'common',
      title: ' 運動会のお知らせ ',
      receivedOn: '2026-09-25',
      dueOn: '',
      topicIds: ['t1', 't2'],
      responseStatus: 'todo',
      images: [jpegFile('1.jpg'), jpegFile('2.jpg')],
    }),
  })

  expect(res.status).toBe(201)
  expect(await res.json()).toEqual(ref)
  const [user, input] = create.mock.calls[0]
  expect(user).toEqual(invitedUser)
  expect(input).toMatchObject({
    childId: null,
    title: '運動会のお知らせ',
    receivedOn: '2026-09-25',
    dueOn: null,
    topicIds: ['t1', 't2'],
    responseStatus: 'todo',
  })
  expect(input.images).toHaveLength(2)
})

test('POST /prints accepts a single photo and topic, with defaults for the rest', async () => {
  const create = vi.fn<PrintService['create']>(async () => ref)
  const app = createTestApp({ services: { printService: { create } } })

  await app.request('/prints', {
    method: 'POST',
    ...authorized,
    body: form({ childId: 'c1', images: jpegFile() }),
  })

  expect(create.mock.calls[0][1]).toMatchObject({
    childId: 'c1',
    title: null,
    receivedOn: null,
    dueOn: null,
    topicIds: [],
    responseStatus: 'none',
  })
})

test('POST /prints validates photos, topics, title and dates', async () => {
  const app = createTestApp()
  const post = (fields: Record<string, string | File | (string | File)[]>) =>
    app.request('/prints', { method: 'POST', ...authorized, body: form(fields) })
  const tooMany = Array.from({ length: LIMITS.printImages + 1 }, () => jpegFile())
  const png = new File([new Uint8Array([0x89])], 'a.png', { type: 'image/png' })

  expect((await post({ childId: 'c1' })).status).toBe(400)
  expect((await post({ childId: 'c1', images: tooMany })).status).toBe(400)
  expect((await post({ childId: 'c1', images: png })).status).toBe(400)
  expect(
    (
      await post({
        childId: 'c1',
        images: jpegFile(),
        topicIds: Array.from({ length: LIMITS.printTopics + 1 }, (_, i) => `t${i}`),
      })
    ).status,
  ).toBe(400)
  expect((await post({ childId: 'c1', images: jpegFile(), title: 'あ'.repeat(51) })).status).toBe(
    400,
  )
  expect((await post({ childId: 'c1', images: jpegFile(), dueOn: '2026-13-01' })).status).toBe(400)
})

test('POST /prints maps storage_limit to 413', async () => {
  const app = createTestApp({
    services: {
      printService: {
        create: async () => {
          throw new AppError('storage_limit')
        },
      },
    },
  })

  const res = await app.request('/prints', {
    method: 'POST',
    ...authorized,
    body: form({ childId: 'c1', images: jpegFile() }),
  })

  expect(res.status).toBe(413)
  expect(await res.json()).toEqual({ error: 'storage_limit' })
})

test('GET /prints/:id returns the detail, uncached', async () => {
  const detail = vi.fn<PrintService['detail']>(async () => ({ id: 'p1' }) as never)
  const app = createTestApp({ user: invitedUser, services: { printService: { detail } } })

  const res = await app.request('/prints/p1', authorized)

  expect(res.status).toBe(200)
  expect(res.headers.get('cache-control')).toBe('no-store')
  expect(detail).toHaveBeenCalledWith(invitedUser, 'p1')
})

test('PATCH /prints/:id passes only the given fields, with null clearing and moving', async () => {
  const update = vi.fn<PrintService['update']>(async () => ref)
  const app = createTestApp({ services: { printService: { update } } })

  const res = await app.request(
    '/prints/p1',
    json('PATCH', { childId: null, title: '', dueOn: null, responseStatus: 'done' }),
  )

  expect(res.status).toBe(200)
  expect(update.mock.calls[0].slice(1)).toEqual([
    'p1',
    { childId: null, title: null, dueOn: null, responseStatus: 'done' },
  ])
  expect((await app.request('/prints/p1', json('PATCH', { responseStatus: 'maybe' }))).status).toBe(
    400,
  )
})

test('PUT /prints/:id/images retakes the photos', async () => {
  const replaceImages = vi.fn<PrintService['replaceImages']>(async () => ({
    images: [{ id: 'n1', page: 1 }],
  }))
  const app = createTestApp({ services: { printService: { replaceImages } } })

  const res = await app.request('/prints/p1/images', {
    method: 'PUT',
    ...authorized,
    body: form({ images: [jpegFile()] }),
  })

  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ images: [{ id: 'n1', page: 1 }] })
  expect(replaceImages.mock.calls[0][1]).toBe('p1')
})

test('DELETE /prints/:id deletes the print', async () => {
  const deleteFn = vi.fn<PrintService['delete']>(async () => {})
  const app = createTestApp({ services: { printService: { delete: deleteFn } } })

  const res = await app.request('/prints/p1', { method: 'DELETE', ...authorized })

  expect(res.status).toBe(204)
  expect(deleteFn.mock.calls[0][1]).toBe('p1')
})

test('bulk delete counts and deletes for an allowed period only', async () => {
  const countOld = vi.fn<PrintService['countOld']>(async () => ({ count: 4, bytes: 4000 }))
  const deleteOld = vi.fn<PrintService['deleteOld']>(async () => ({ count: 4 }))
  const app = createTestApp({ services: { printService: { countOld, deleteOld } } })

  const count = await app.request('/prints/bulk-delete?olderThanMonths=6', authorized)
  expect(await count.json()).toEqual({ count: 4, bytes: 4000 })
  expect(countOld.mock.calls[0][1]).toBe(6)

  const deleted = await app.request('/prints/bulk-delete', json('POST', { olderThanMonths: 12 }))
  expect(await deleted.json()).toEqual({ count: 4 })
  expect(deleteOld.mock.calls[0][1]).toBe(12)

  expect((await app.request('/prints/bulk-delete?olderThanMonths=2', authorized)).status).toBe(400)
})

test('POST /prints/:id/mitene sends mitene to the given members', async () => {
  const send = vi.fn<MiteneService['send']>(async () => {})
  const app = createTestApp({ user: invitedUser, services: { miteneService: { send } } })

  const res = await app.request('/prints/p1/mitene', json('POST', { memberIds: ['owner', 'm3'] }))

  expect(res.status).toBe(204)
  expect(send).toHaveBeenCalledWith(invitedUser, 'p1', ['owner', 'm3'])
})

test('POST /prints/:id/mitene needs at least one recipient', async () => {
  const app = createTestApp()

  expect((await app.request('/prints/p1/mitene', json('POST', { memberIds: [] }))).status).toBe(400)
})
