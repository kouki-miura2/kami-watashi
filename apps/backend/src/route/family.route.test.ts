import { expect, test, vi } from 'vite-plus/test'

import type { FamilyService } from '../service/family.service.ts'
import { authorized, createTestApp, invitedUser, ownerUser } from '../testing.ts'

test('DELETE /family withdraws the owner’s family', async () => {
  const withdraw = vi.fn<FamilyService['withdraw']>(async () => {})
  const app = createTestApp({ services: { familyService: { withdraw } } })

  const res = await app.request('/family', { method: 'DELETE', ...authorized })

  expect(res.status).toBe(204)
  expect(withdraw).toHaveBeenCalledWith(ownerUser)
})

test('DELETE /family is owner-only', async () => {
  const withdraw = vi.fn<FamilyService['withdraw']>(async () => {})
  const app = createTestApp({ user: invitedUser, services: { familyService: { withdraw } } })

  const res = await app.request('/family', { method: 'DELETE', ...authorized })

  expect(res.status).toBe(403)
  expect(withdraw).not.toHaveBeenCalled()
})
