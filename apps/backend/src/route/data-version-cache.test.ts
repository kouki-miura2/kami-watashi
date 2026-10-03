import { Hono } from 'hono'
import { afterEach, beforeEach, expect, test, vi } from 'vite-plus/test'

import type { AuthenticatedUser } from '../repository/auth-guard.interface.ts'
import { invitedUser } from '../testing.ts'
import type { AppEnv } from './context.ts'
import { createDataVersionCache } from './data-version-cache.ts'

beforeEach(() => {
  vi.useFakeTimers()
  // 00:30 JST on 2026-10-04.
  vi.setSystemTime(new Date('2026-10-03T15:30:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

const createApp = (user: AuthenticatedUser = invitedUser, status: 200 | 404 = 200) => {
  const handler = vi.fn(() => {})
  const app = new Hono<AppEnv>()
    .use(async (c, next) => {
      c.set('user', user)
      await next()
    })
    .get('/', createDataVersionCache({ deploymentId: 'd1' }), (c) => {
      handler()
      return c.json({ ok: true }, status)
    })
  return { app, handler }
}

const etag = 'W/"d1.1.invited.2026-10-04"'

test('tags the response with the deployment, data version, member and JST date', async () => {
  const { app, handler } = createApp()

  const res = await app.request('/')

  expect(res.status).toBe(200)
  expect(res.headers.get('etag')).toBe(etag)
  expect(res.headers.get('cache-control')).toBe('private, no-cache')
  expect(handler).toHaveBeenCalledOnce()
})

test('answers 304 without running the route while the tag is current', async () => {
  const { app, handler } = createApp()

  const res = await app.request('/', { headers: { 'if-none-match': `W/"other", ${etag}` } })

  expect(res.status).toBe(304)
  expect(res.headers.get('etag')).toBe(etag)
  expect(handler).not.toHaveBeenCalled()
})

test('runs the route again once the data, the member or the day changed', async () => {
  const headers = { 'if-none-match': etag }

  expect(
    (await createApp({ ...invitedUser, dataVersion: 2 }).app.request('/', { headers })).status,
  ).toBe(200)
  expect(
    (await createApp({ ...invitedUser, id: 'owner' }).app.request('/', { headers })).status,
  ).toBe(200)
  vi.setSystemTime(new Date('2026-10-04T15:00:00Z'))
  expect((await createApp().app.request('/', { headers })).status).toBe(200)
})

test('leaves an error response untagged', async () => {
  const res = await createApp(invitedUser, 404).app.request('/')

  expect(res.status).toBe(404)
  expect(res.headers.get('etag')).toBeNull()
})
