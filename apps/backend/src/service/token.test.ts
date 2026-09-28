import { sign } from 'hono/jwt'
import { LIMITS } from 'utils'
import { expect, test } from 'vite-plus/test'

import {
  generateMemberKey,
  hashMemberKey,
  isMemberKey,
  issueInviteToken,
  issueSessionToken,
  verifyInviteToken,
  verifySessionToken,
} from './token.ts'

const secret = 'test-secret'

test('a session token round-trips its claims', async () => {
  const { token } = await issueSessionToken({ memberId: 'm1', familyId: 'f1' }, secret)

  expect(await verifySessionToken(token, secret)).toEqual({ memberId: 'm1', familyId: 'f1' })
})

test('a session token expires after LIMITS.ownerSessionDays', async () => {
  const now = Date.UTC(2026, 0, 1)
  const { expiresAt } = await issueSessionToken({ memberId: 'm1', familyId: 'f1' }, secret, now)

  expect(expiresAt - now).toBe(LIMITS.ownerSessionDays * 24 * 60 * 60 * 1000)
})

test('rejects an expired session token', async () => {
  const longAgo = Date.now() - (LIMITS.ownerSessionDays + 1) * 24 * 60 * 60 * 1000
  const { token } = await issueSessionToken({ memberId: 'm1', familyId: 'f1' }, secret, longAgo)

  expect(await verifySessionToken(token, secret)).toBeNull()
})

test('rejects a token signed with another secret', async () => {
  const { token } = await issueSessionToken({ memberId: 'm1', familyId: 'f1' }, 'other-secret')

  expect(await verifySessionToken(token, secret)).toBeNull()
})

test('rejects a validly signed token of another type', async () => {
  const exp = Math.floor(Date.now() / 1000) + 60
  const token = await sign({ typ: 'invite', sub: 'm1', fam: 'f1', exp }, secret, 'HS256')

  expect(await verifySessionToken(token, secret)).toBeNull()
})

test('rejects garbage', async () => {
  expect(await verifySessionToken('not-a-jwt', secret)).toBeNull()
})

test('generates distinct, prefixed, URL-safe member keys', () => {
  const a = generateMemberKey()
  const b = generateMemberKey()

  expect(a).not.toBe(b)
  expect(isMemberKey(a)).toBe(true)
  expect(a).toMatch(/^mk_[A-Za-z0-9_-]{43}$/)
})

test('hashes a member key with SHA-256 hex', async () => {
  expect(await hashMemberKey('abc')).toBe(
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  )
})

test('an invite token round-trips its family and expires after LIMITS.inviteTokenTtlMinutes', async () => {
  const now = Date.now()
  const { token, expiresAt } = await issueInviteToken('f1', secret, now)

  expect(expiresAt - now).toBe(LIMITS.inviteTokenTtlMinutes * 60 * 1000)
  expect(await verifyInviteToken(token, secret)).toEqual({ valid: true, familyId: 'f1' })
})

test('reports an expired invite token as expired', async () => {
  const longAgo = Date.now() - (LIMITS.inviteTokenTtlMinutes + 1) * 60 * 1000
  const { token } = await issueInviteToken('f1', secret, longAgo)

  expect(await verifyInviteToken(token, secret)).toEqual({ valid: false, reason: 'expired' })
})

test('does not accept a session token as an invite token, or vice versa', async () => {
  const session = await issueSessionToken({ memberId: 'm1', familyId: 'f1' }, secret)
  const invite = await issueInviteToken('f1', secret)

  expect(await verifyInviteToken(session.token, secret)).toEqual({
    valid: false,
    reason: 'invalid',
  })
  expect(await verifySessionToken(invite.token, secret)).toBeNull()
})

test('rejects an invite token signed with another secret', async () => {
  const { token } = await issueInviteToken('f1', 'other-secret')

  expect(await verifyInviteToken(token, secret)).toEqual({ valid: false, reason: 'invalid' })
})
