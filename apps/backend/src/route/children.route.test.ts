import { expect, test, vi } from 'vite-plus/test'

import type { ChildService } from '../service/child.service.ts'
import { AppError } from '../service/errors.ts'
import { authorized, createTestApp, invitedUser } from '../testing.ts'

const json = (method: string, body: unknown) => ({
  method,
  headers: { ...authorized.headers, 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

test('GET /children returns the slots of the caller', async () => {
  const slots = [{ id: null, name: '家族共通', weekCount: 1, miteneCount: 2 }]
  const listSlots = vi.fn<ChildService['listSlots']>(async () => slots)
  const app = createTestApp({ user: invitedUser, services: { childService: { listSlots } } })

  const res = await app.request('/children', authorized)

  expect(res.status).toBe(200)
  expect(await res.json()).toEqual(slots)
  expect(listSlots).toHaveBeenCalledWith(invitedUser)
})

test('POST /children creates a child (members may, not only the owner)', async () => {
  const create = vi.fn<ChildService['create']>(async (_, name) => ({ id: 'c1', name }))
  const app = createTestApp({ user: invitedUser, services: { childService: { create } } })

  const res = await app.request('/children', json('POST', { name: ' はなこ ' }))

  expect(res.status).toBe(201)
  expect(await res.json()).toEqual({ id: 'c1', name: 'はなこ' })
  expect(create).toHaveBeenCalledWith(invitedUser, 'はなこ')
})

test('POST /children validates the name and maps name_taken to 409', async () => {
  const app = createTestApp({
    services: {
      childService: {
        create: async () => {
          throw new AppError('name_taken')
        },
      },
    },
  })

  expect((await app.request('/children', json('POST', { name: '' }))).status).toBe(400)
  expect((await app.request('/children', json('POST', { name: 'はなこ' }))).status).toBe(409)
})

test('PATCH /children/:id renames the child', async () => {
  const rename = vi.fn<ChildService['rename']>(async (_, id, name) => ({ id, name }))
  const app = createTestApp({ user: invitedUser, services: { childService: { rename } } })

  const res = await app.request('/children/c1', json('PATCH', { name: 'かなこ' }))

  expect(res.status).toBe(200)
  expect(rename).toHaveBeenCalledWith(invitedUser, 'c1', 'かなこ')
})

test('DELETE /children/:id deletes the child, or answers 404', async () => {
  const deleteFn = vi.fn<ChildService['delete']>(async (_, id) => {
    if (id !== 'c1') throw new AppError('not_found')
  })
  const app = createTestApp({ user: invitedUser, services: { childService: { delete: deleteFn } } })

  expect((await app.request('/children/c1', { method: 'DELETE', ...authorized })).status).toBe(204)
  expect(deleteFn).toHaveBeenCalledWith(invitedUser, 'c1')
  expect((await app.request('/children/x', { method: 'DELETE', ...authorized })).status).toBe(404)
})
