import { expect, test, vi } from 'vite-plus/test'

import type { AuthService } from '../service/auth.service.ts'
import { createTestApp } from '../testing.ts'

const session = { sessionToken: 'token', expiresAt: 1 }

const createApp = (devLogin: boolean) => {
  const authService = {
    devLogin: vi.fn<AuthService['devLogin']>(async () => session),
    launch: vi.fn(),
  }
  return { app: createTestApp({ config: { devLogin }, services: { authService } }), authService }
}

const login = (body: unknown, host = 'http://localhost:8787') => ({
  url: `${host}/dev/login`,
  init: {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  },
})

test('POST /dev/login signs in without credentials when devLogin is on', async () => {
  const { app, authService } = createApp(true)
  const { url, init } = login({ googleSub: 'dev-owner-1', name: ' 一郎 ' })

  const res = await app.request(url, init)

  expect(res.status).toBe(200)
  expect(await res.json()).toEqual(session)
  expect(authService.devLogin).toHaveBeenCalledWith({ googleSub: 'dev-owner-1', name: '一郎' })
})

test('POST /dev/login does not exist when devLogin is off', async () => {
  const { app, authService } = createApp(false)
  const { url, init } = login({ googleSub: 'dev-owner-1', name: '一郎' })

  const res = await app.request(url, init)

  expect(res.status).toBe(404)
  expect(authService.devLogin).not.toHaveBeenCalled()
})

test('POST /dev/login refuses non-local hostnames even when devLogin is on', async () => {
  const { app, authService } = createApp(true)
  const { url, init } = login({ googleSub: 'dev-owner-1', name: '一郎' }, 'https://api.example.com')

  const res = await app.request(url, init)

  expect(res.status).toBe(404)
  expect(authService.devLogin).not.toHaveBeenCalled()
})

test('POST /dev/login validates the name', async () => {
  const { app } = createApp(true)
  const { url, init } = login({ googleSub: 'dev-owner-1', name: 'あ'.repeat(21) })

  const res = await app.request(url, init)

  expect(res.status).toBe(400)
  expect(await res.json()).toMatchObject({ error: 'invalid_input' })
})
