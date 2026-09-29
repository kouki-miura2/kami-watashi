import { Hono } from 'hono'

import type { PrintService } from '../service/print.service.ts'
import { type AppEnv, currentUser } from './context.ts'

export const createImagesRoutes = (deps: { printService: PrintService }) =>
  new Hono<AppEnv>().get('/:id', async (c) => {
    const image = await deps.printService.getImage(currentUser(c), c.req.param('id'))
    return c.body(image.body, 200, {
      'content-type': image.contentType,
      'content-length': String(image.size),
      // An image id is never reused (retaking photos creates new ids), so its content never
      // changes: cache it for good, but only in the member's own client (`private`).
      'cache-control': 'private, max-age=31536000, immutable',
    })
  })
