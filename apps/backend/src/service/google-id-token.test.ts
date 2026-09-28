import { sign } from 'hono/jwt'
import type { HonoJsonWebKey } from 'hono/utils/jwt/jws'
import { beforeAll, expect, test } from 'vite-plus/test'

import { createGoogleIdTokenVerifier } from './google-id-token.ts'

const CLIENT_ID = 'ios-client.apps.googleusercontent.com'

let privateKey: HonoJsonWebKey
let publicKey: HonoJsonWebKey

beforeAll(async () => {
  const pair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  )
  privateKey = { ...(await crypto.subtle.exportKey('jwk', pair.privateKey)), kid: 'test-key' }
  publicKey = {
    ...(await crypto.subtle.exportKey('jwk', pair.publicKey)),
    kid: 'test-key',
    alg: 'RS256',
  }
})

const idToken = (claims: Record<string, unknown> = {}) =>
  sign(
    {
      iss: 'https://accounts.google.com',
      aud: CLIENT_ID,
      sub: 'google-123',
      name: '山田 一郎',
      exp: Math.floor(Date.now() / 1000) + 3600,
      ...claims,
    },
    privateKey,
    'RS256',
  )

const verifier = (clientIds = [CLIENT_ID]) =>
  createGoogleIdTokenVerifier({ clientIds, keys: [publicKey] })

test('returns the identity in a valid token', async () => {
  expect(await verifier().verify(await idToken())).toEqual({ sub: 'google-123', name: '山田 一郎' })
})

test('accepts the issuer without the https:// prefix', async () => {
  expect(await verifier().verify(await idToken({ iss: 'accounts.google.com' }))).not.toBeNull()
})

test('returns an empty name when the token has none', async () => {
  expect(await verifier().verify(await idToken({ name: undefined }))).toEqual({
    sub: 'google-123',
    name: '',
  })
})

test('rejects a token issued to another client', async () => {
  expect(await verifier().verify(await idToken({ aud: 'someone-else' }))).toBeNull()
})

test('rejects a token from another issuer', async () => {
  expect(await verifier().verify(await idToken({ iss: 'https://evil.example' }))).toBeNull()
})

test('rejects an expired token', async () => {
  const exp = Math.floor(Date.now() / 1000) - 60
  expect(await verifier().verify(await idToken({ exp }))).toBeNull()
})

test('rejects an HS256 token even if it names a known kid', async () => {
  const forged = await sign(
    { iss: 'accounts.google.com', aud: CLIENT_ID, sub: 'x', exp: Date.now() / 1000 + 60 },
    'guessable-secret',
    'HS256',
  )
  expect(await verifier().verify(forged)).toBeNull()
})

test('rejects everything when no client ids are configured', async () => {
  expect(await verifier([]).verify(await idToken())).toBeNull()
})
