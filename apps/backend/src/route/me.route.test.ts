import { expect, test, vi } from 'vite-plus/test'

import { AppError } from '../service/errors.ts'
import type { MemberService } from '../service/member.service.ts'
import { authorized, createTestApp, invitedUser } from '../testing.ts'

const json = (method: string, body: unknown) => ({
  method,
  headers: { ...authorized.headers, 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

test('PATCH /me renames the caller', async () => {
  const rename = vi.fn<MemberService['rename']>(async (_, name) => ({ id: 'invited', name }))
  const app = createTestApp({ user: invitedUser, services: { memberService: { rename } } })

  const res = await app.request('/me', json('PATCH', { name: ' 二朗 ' }))

  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ id: 'invited', name: '二朗' })
  expect(rename).toHaveBeenCalledWith(invitedUser, '二朗')
})

test('PATCH /me maps name_taken to 409', async () => {
  const app = createTestApp({
    services: {
      memberService: {
        rename: async () => {
          throw new AppError('name_taken')
        },
      },
    },
  })

  const res = await app.request('/me', json('PATCH', { name: '一郎' }))

  expect(res.status).toBe(409)
  expect(await res.json()).toEqual({ error: 'name_taken' })
})

test('PATCH /me rejects a name over the limit', async () => {
  const app = createTestApp()

  const res = await app.request('/me', json('PATCH', { name: 'あ'.repeat(21) }))

  expect(res.status).toBe(400)
})

test('POST /me/terms records agreement, even for a member whose terms are outdated', async () => {
  const agreeTerms = vi.fn<MemberService['agreeTerms']>(async () => {})
  const user = { ...invitedUser, termsVersion: 'old' }
  const app = createTestApp({ user, services: { memberService: { agreeTerms } } })

  const res = await app.request('/me/terms', json('POST', { termsVersion: 'v1' }))

  expect(res.status).toBe(204)
  expect(agreeTerms).toHaveBeenCalledWith(user, 'v1')
})

test('POST /me/terms maps a stale version to 400', async () => {
  const app = createTestApp({
    services: {
      memberService: {
        agreeTerms: async () => {
          throw new AppError('invalid_terms_version')
        },
      },
    },
  })

  const res = await app.request('/me/terms', json('POST', { termsVersion: 'v0' }))

  expect(res.status).toBe(400)
  expect(await res.json()).toEqual({ error: 'invalid_terms_version' })
})

test('DELETE /me lets an invited member leave', async () => {
  const leave = vi.fn<MemberService['leave']>(async () => {})
  const app = createTestApp({ user: invitedUser, services: { memberService: { leave } } })

  const res = await app.request('/me', { method: 'DELETE', ...authorized })

  expect(res.status).toBe(204)
  expect(leave).toHaveBeenCalledWith(invitedUser)
})

test('DELETE /me maps the owner’s refusal to 403', async () => {
  const app = createTestApp({
    services: {
      memberService: {
        leave: async () => {
          throw new AppError('forbidden')
        },
      },
    },
  })

  expect((await app.request('/me', { method: 'DELETE', ...authorized })).status).toBe(403)
})
