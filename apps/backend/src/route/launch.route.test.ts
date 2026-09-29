import { expect, test, vi } from 'vite-plus/test'

import type { AuthService, LaunchView } from '../service/auth.service.ts'
import { WEB_ORIGIN, authorized, createTestApp, ownerUser } from '../testing.ts'

test('POST /launch returns the launch view and renews the owner session cookie', async () => {
  const view: LaunchView = {
    me: { id: 'owner', name: '一郎', isOwner: true },
    termsVersion: 'v1',
    termsAgreed: true,
    session: { sessionToken: 'renewed', expiresAt: 1 },
  }
  const launch = vi.fn<AuthService['launch']>(async () => view)
  const app = createTestApp({ services: { authService: { launch } } })

  const res = await app.request('/launch', { method: 'POST', ...authorized })

  expect(res.status).toBe(200)
  const { session: _, ...body } = view
  expect(await res.json()).toEqual(body)
  expect(res.headers.get('set-cookie')).toMatch(/^__Host-credential=renewed;.*HttpOnly/)
  expect(launch).toHaveBeenCalledWith(ownerUser)
})

test('POST /launch renews an invited member key cookie', async () => {
  const launch = vi.fn<AuthService['launch']>(async () => ({
    me: { id: 'invited', name: '二郎', isOwner: false },
    termsVersion: 'v1',
    termsAgreed: true,
    session: null,
  }))
  const app = createTestApp({ services: { authService: { launch } } })

  const res = await app.request('/launch', { method: 'POST', ...authorized })

  expect(res.headers.get('set-cookie')).toMatch(/^__Host-credential=test; Max-Age=34560000;/)
})

test('POST /launch requires credentials', async () => {
  const app = createTestApp()

  const res = await app.request('/launch', { method: 'POST', headers: { origin: WEB_ORIGIN } })

  expect(res.status).toBe(401)
})
