import { expect, test, vi } from 'vite-plus/test'

import type { AuthService, LaunchView } from '../service/auth.service.ts'
import { authorized, createTestApp, ownerUser } from '../testing.ts'

test('POST /launch returns the launch view for the caller', async () => {
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
  expect(await res.json()).toEqual(view)
  expect(launch).toHaveBeenCalledWith(ownerUser)
})

test('POST /launch requires credentials', async () => {
  const app = createTestApp()

  const res = await app.request('/launch', { method: 'POST' })

  expect(res.status).toBe(401)
})
