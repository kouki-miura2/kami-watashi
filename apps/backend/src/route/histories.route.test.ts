import { expect, test, vi } from 'vite-plus/test'

import { AppError } from '../service/errors.ts'
import type { HistoryService } from '../service/history.service.ts'
import { authorized, createTestApp, invitedUser } from '../testing.ts'

test('GET /histories returns the newest page, then continues from a cursor', async () => {
  const page = { items: [], nextCursor: '9950.450' }
  const list = vi.fn<HistoryService['list']>(async () => page)
  const app = createTestApp({ user: invitedUser, services: { historyService: { list } } })

  expect(await (await app.request('/histories', authorized)).json()).toEqual(page)
  await app.request('/histories?cursor=9950.450', authorized)

  expect(list.mock.calls).toEqual([
    [invitedUser, undefined],
    [invitedUser, '9950.450'],
  ])
})

test('GET /histories maps a bad cursor to 400', async () => {
  const app = createTestApp({
    services: {
      historyService: {
        list: async () => {
          throw new AppError('invalid_input')
        },
      },
    },
  })

  expect((await app.request('/histories?cursor=x', authorized)).status).toBe(400)
})
