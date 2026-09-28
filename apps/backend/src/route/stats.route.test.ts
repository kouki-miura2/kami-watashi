import { expect, test, vi } from 'vite-plus/test'

import type { StatsService } from '../service/stats.service.ts'
import { authorized, createTestApp, invitedUser } from '../testing.ts'

test('GET /stats returns the stats of the caller family', async () => {
  const stats = { weekly: [], monthly: [], storage: { usedBytes: 1, limitBytes: 2 } }
  const get = vi.fn<StatsService['get']>(async () => stats)
  const app = createTestApp({ user: invitedUser, services: { statsService: { get } } })

  const res = await app.request('/stats', authorized)

  expect(await res.json()).toEqual(stats)
  expect(get).toHaveBeenCalledWith(invitedUser)
  expect((await app.request('/stats')).status).toBe(401)
})
