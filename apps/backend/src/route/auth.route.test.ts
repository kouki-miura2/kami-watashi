import { expect, test, vi } from 'vite-plus/test'

import type { AuthService } from '../service/auth.service.ts'
import { AppError } from '../service/errors.ts'
import { createTestApp } from '../testing.ts'

const session = { sessionToken: 'token', expiresAt: 1 }

const post = (path: string, body: unknown) => ({
  path,
  init: {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  },
})

test('POST /auth/google signs in without credentials, setting the session cookie', async () => {
  const googleLogin = vi.fn<AuthService['googleLogin']>(async () => session)
  const app = createTestApp({ services: { authService: { googleLogin } } })
  const { path, init } = post('/auth/google', { idToken: 'id-token' })

  const res = await app.request(path, init)

  expect(res.status).toBe(204)
  const cookie = res.headers.get('set-cookie')
  expect(cookie).toMatch(/^__Host-credential=token;/)
  expect(cookie).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT')
  for (const attribute of ['Path=/', 'HttpOnly', 'Secure', 'SameSite=Lax']) {
    expect(cookie).toContain(attribute)
  }
  expect(googleLogin).toHaveBeenCalledWith('id-token')
})

test('POST /auth/google answers an unregistered account with 404 and the suggested name', async () => {
  const app = createTestApp({
    services: {
      authService: {
        googleLogin: async () => {
          throw new AppError('not_registered', { suggestedName: '山田 一郎' })
        },
      },
    },
  })
  const { path, init } = post('/auth/google', { idToken: 'id-token' })

  const res = await app.request(path, init)

  expect(res.status).toBe(404)
  expect(await res.json()).toEqual({
    error: 'not_registered',
    details: { suggestedName: '山田 一郎' },
  })
})

test('POST /auth/google/register registers without credentials', async () => {
  const register = vi.fn<AuthService['register']>(async () => session)
  const app = createTestApp({ services: { authService: { register } } })
  const body = { idToken: 'id-token', name: ' 一郎 ', termsVersion: 'v1' }
  const { path, init } = post('/auth/google/register', body)

  const res = await app.request(path, init)

  expect(res.status).toBe(204)
  expect(res.headers.get('set-cookie')).toMatch(/^__Host-credential=token;/)
  expect(register).toHaveBeenCalledWith({ idToken: 'id-token', name: '一郎', termsVersion: 'v1' })
})

test('POST /auth/google/register maps already_registered to 409', async () => {
  const app = createTestApp({
    services: {
      authService: {
        register: async () => {
          throw new AppError('already_registered')
        },
      },
    },
  })
  const { path, init } = post('/auth/google/register', {
    idToken: 'id-token',
    name: '一郎',
    termsVersion: 'v1',
  })

  expect((await app.request(path, init)).status).toBe(409)
})

test('POST /auth/google/register validates the input', async () => {
  const app = createTestApp()
  const { path, init } = post('/auth/google/register', { idToken: 'id-token', name: '' })

  const res = await app.request(path, init)

  expect(res.status).toBe(400)
  expect(await res.json()).toMatchObject({ error: 'invalid_input' })
})
