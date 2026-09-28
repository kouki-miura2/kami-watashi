import { expect, test, vi } from 'vite-plus/test'

import { AppError } from '../service/errors.ts'
import type { InviteService } from '../service/invite.service.ts'
import { authorized, createTestApp, invitedUser, ownerUser } from '../testing.ts'

const invite = { inviteToken: 'invite', expiresAt: 1 }

test('POST /invites issues an invite for the owner', async () => {
  const createInvite = vi.fn<InviteService['createInvite']>(async () => invite)
  const app = createTestApp({ services: { inviteService: { createInvite } } })

  const res = await app.request('/invites', { method: 'POST', ...authorized })

  expect(res.status).toBe(200)
  expect(await res.json()).toEqual(invite)
  expect(createInvite).toHaveBeenCalledWith(ownerUser)
})

test('POST /invites is owner-only', async () => {
  const createInvite = vi.fn<InviteService['createInvite']>(async () => invite)
  const app = createTestApp({ user: invitedUser, services: { inviteService: { createInvite } } })

  const res = await app.request('/invites', { method: 'POST', ...authorized })

  expect(res.status).toBe(403)
  expect(await res.json()).toEqual({ error: 'forbidden' })
  expect(createInvite).not.toHaveBeenCalled()
})

test('POST /invites maps member_limit to 409', async () => {
  const app = createTestApp({
    services: {
      inviteService: {
        createInvite: async () => {
          throw new AppError('member_limit')
        },
      },
    },
  })

  expect((await app.request('/invites', { method: 'POST', ...authorized })).status).toBe(409)
})

const redeem = (body: unknown) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

test('POST /invites/redeem joins without credentials and returns the member key', async () => {
  const redeemFn = vi.fn<InviteService['redeem']>(async () => ({ memberKey: 'mk_key' }))
  const app = createTestApp({ services: { inviteService: { redeem: redeemFn } } })

  const res = await app.request(
    '/invites/redeem',
    redeem({ inviteToken: 'invite', name: '二郎', termsVersion: 'v1' }),
  )

  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ memberKey: 'mk_key' })
  expect(redeemFn).toHaveBeenCalledWith({ inviteToken: 'invite', name: '二郎', termsVersion: 'v1' })
})

test('POST /invites/redeem maps an expired invite to 400', async () => {
  const app = createTestApp({
    services: {
      inviteService: {
        redeem: async () => {
          throw new AppError('invite_expired')
        },
      },
    },
  })

  const res = await app.request(
    '/invites/redeem',
    redeem({ inviteToken: 'invite', name: '二郎', termsVersion: 'v1' }),
  )

  expect(res.status).toBe(400)
  expect(await res.json()).toEqual({ error: 'invite_expired' })
})

test('POST /invites/redeem validates the input', async () => {
  const app = createTestApp()

  const res = await app.request('/invites/redeem', redeem({ inviteToken: 'invite' }))

  expect(res.status).toBe(400)
})
