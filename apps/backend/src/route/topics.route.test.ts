import { expect, test, vi } from 'vite-plus/test'

import { AppError } from '../service/errors.ts'
import type { TopicService } from '../service/topic.service.ts'
import { authorized, createTestApp, invitedUser } from '../testing.ts'

const json = (method: string, body: unknown) => ({
  method,
  headers: { ...authorized.headers, 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

test('GET /topics lists the topics of the caller family', async () => {
  const topics = [{ id: 't1', name: 'サッカー', printCount: 2 }]
  const list = vi.fn<TopicService['list']>(async () => topics)
  const app = createTestApp({ user: invitedUser, services: { topicService: { list } } })

  const res = await app.request('/topics', authorized)

  expect(await res.json()).toEqual(topics)
  expect(list).toHaveBeenCalledWith(invitedUser)
})

test('POST /topics creates a topic', async () => {
  const create = vi.fn<TopicService['create']>(async (_, name) => ({ id: 't1', name }))
  const app = createTestApp({ user: invitedUser, services: { topicService: { create } } })

  const res = await app.request('/topics', json('POST', { name: 'サッカー' }))

  expect(res.status).toBe(201)
  expect(await res.json()).toEqual({ id: 't1', name: 'サッカー' })
})

test('POST /topics rejects a name over the limit', async () => {
  const app = createTestApp()

  expect((await app.request('/topics', json('POST', { name: 'あ'.repeat(21) }))).status).toBe(400)
})

test('PATCH /topics/:id renames the topic, mapping name_taken to 409', async () => {
  const rename = vi.fn<TopicService['rename']>(async (_, id, name) => {
    if (name === '試合') throw new AppError('name_taken')
    return { id, name }
  })
  const app = createTestApp({ services: { topicService: { rename } } })

  expect(
    await (await app.request('/topics/t1', json('PATCH', { name: 'サッカークラブ' }))).json(),
  ).toEqual({ id: 't1', name: 'サッカークラブ' })
  expect((await app.request('/topics/t1', json('PATCH', { name: '試合' }))).status).toBe(409)
})

test('DELETE /topics/:id deletes the topic', async () => {
  const deleteFn = vi.fn<TopicService['delete']>(async () => {})
  const app = createTestApp({ user: invitedUser, services: { topicService: { delete: deleteFn } } })

  const res = await app.request('/topics/t1', { method: 'DELETE', ...authorized })

  expect(res.status).toBe(204)
  expect(deleteFn).toHaveBeenCalledWith(invitedUser, 't1')
})
