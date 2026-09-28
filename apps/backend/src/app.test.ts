import { expect, test, vi } from 'vite-plus/test'

import { AppError } from './service/errors.ts'
import type { MemberService } from './service/member.service.ts'
import { authorized, createTestApp, invitedUser, ownerUser } from './testing.ts'

const memberService = (listMembers: MemberService['listMembers']): Partial<MemberService> => ({
  listMembers,
})
const listOk = memberService(async () => [])

test('rejects a request without credentials with 401', async () => {
  const app = createTestApp({ services: { memberService: listOk } })

  const res = await app.request('/members')

  expect(res.status).toBe(401)
  expect(await res.json()).toEqual({ error: 'unauthorized' })
})

test('rejects a member who has not agreed to the current terms with 403', async () => {
  const app = createTestApp({
    user: { ...invitedUser, termsVersion: 'old' },
    services: { memberService: listOk },
  })

  const res = await app.request('/members', authorized)

  expect(res.status).toBe(403)
  expect(await res.json()).toEqual({ error: 'terms_required' })
})

test('lets a member with outdated terms launch the app', async () => {
  const launch = vi.fn(async () => ({
    me: { id: 'invited', name: '二郎', isOwner: false },
    termsVersion: 'v1',
    termsAgreed: false,
    session: null,
  }))
  const app = createTestApp({
    user: { ...invitedUser, termsVersion: 'old' },
    services: { authService: { launch } },
  })

  const res = await app.request('/launch', { method: 'POST', ...authorized })

  expect(res.status).toBe(200)
})

test('marks API responses as not cacheable', async () => {
  const app = createTestApp({ services: { memberService: listOk } })

  const res = await app.request('/members', authorized)

  expect(res.headers.get('cache-control')).toBe('no-store')
})

test('maps an AppError from a service to its status and code', async () => {
  const app = createTestApp({
    services: {
      memberService: memberService(async () => {
        throw new AppError('forbidden')
      }),
    },
  })

  const res = await app.request('/members', authorized)

  expect(res.status).toBe(403)
  expect(await res.json()).toEqual({ error: 'forbidden' })
})

test('hides unexpected errors behind a 500 and logs them', async () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
  const app = createTestApp({
    services: {
      memberService: memberService(async () => {
        throw new Error('D1 is down')
      }),
    },
  })

  const res = await app.request('/members', authorized)

  expect(res.status).toBe(500)
  expect(await res.json()).toEqual({ error: 'internal_error' })
  expect(error).toHaveBeenCalledTimes(1)
  vi.restoreAllMocks()
})

test('answers unknown paths with a JSON 404', async () => {
  const app = createTestApp()

  const res = await app.request('/nope', authorized)

  expect(res.status).toBe(404)
  expect(await res.json()).toEqual({ error: 'not_found' })
})

test('allows CORS only from configured origins', async () => {
  const app = createTestApp({ services: { memberService: listOk } })
  const preflight = (origin: string) =>
    app.request('/members', {
      method: 'OPTIONS',
      headers: { origin, 'access-control-request-method': 'GET' },
    })

  expect(
    (await preflight('http://localhost:5173')).headers.get('access-control-allow-origin'),
  ).toBe('http://localhost:5173')
  expect((await preflight('https://evil.example')).headers.get('access-control-allow-origin')).toBe(
    null,
  )
})

test('logs a matching started/completed pair, including for a rejected request', async () => {
  const info = vi.spyOn(console, 'info').mockImplementation(() => {})
  const app = createTestApp()

  const res = await app.request('/members')
  expect(res.status).toBe(401)

  expect(info).toHaveBeenCalledTimes(2)
  const [startedLine] = info.mock.calls[0] as [string]
  const [completedLine] = info.mock.calls[1] as [string]
  const started = JSON.parse(startedLine)
  const completed = JSON.parse(completedLine)

  expect(started).toMatchObject({ message: 'request started', method: 'GET', path: '/members' })
  expect(completed).toMatchObject({
    message: 'request completed',
    method: 'GET',
    path: '/members',
    user: 'anonymous',
    status: 401,
  })
  expect(completed.requestId).toBe(started.requestId)
  expect(typeof completed.durationMs).toBe('number')

  info.mockRestore()
})

test('logs the authenticated member id', async () => {
  const info = vi.spyOn(console, 'info').mockImplementation(() => {})
  const app = createTestApp({ services: { memberService: listOk } })

  await app.request('/members', authorized)

  const [completedLine] = info.mock.calls[1] as [string]
  expect(JSON.parse(completedLine)).toMatchObject({ user: ownerUser.id, status: 200 })
  info.mockRestore()
})
