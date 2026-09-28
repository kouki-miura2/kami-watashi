import { expect, test, vi } from 'vite-plus/test'

import { AppError } from '../service/errors.ts'
import type { PrintService } from '../service/print.service.ts'
import { authorized, createTestApp, invitedUser } from '../testing.ts'

test('GET /images/:id streams the JPEG with a private, permanent cache', async () => {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0])
  const getImage = vi.fn<PrintService['getImage']>(async () => ({
    body: new Blob([bytes]).stream(),
    size: bytes.length,
  }))
  const app = createTestApp({ user: invitedUser, services: { printService: { getImage } } })

  const res = await app.request('/images/i1', authorized)

  expect(res.status).toBe(200)
  expect(res.headers.get('content-type')).toBe('image/jpeg')
  expect(res.headers.get('content-length')).toBe('4')
  expect(res.headers.get('cache-control')).toBe('private, max-age=31536000, immutable')
  expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes)
  expect(getImage).toHaveBeenCalledWith(invitedUser, 'i1')
})

test('GET /images/:id requires credentials and answers 404 for another family’s image', async () => {
  const app = createTestApp({
    services: {
      printService: {
        getImage: async () => {
          throw new AppError('not_found')
        },
      },
    },
  })

  expect((await app.request('/images/i1')).status).toBe(401)
  expect((await app.request('/images/i1', authorized)).status).toBe(404)
})
