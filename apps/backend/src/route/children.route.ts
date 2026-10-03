import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import type { ChildService } from '../service/child.service.ts'
import { type AppEnv, currentUser, invalidInput, nameSchema } from './context.ts'
import { createDataVersionCache } from './data-version-cache.ts'

const nameBody = zValidator('json', z.object({ name: nameSchema }), invalidInput)

export const createChildrenRoutes = (deps: {
  childService: ChildService
  config: { deploymentId: string }
}) =>
  new Hono<AppEnv>()
    .get('/', createDataVersionCache(deps.config), async (c) =>
      c.json(await deps.childService.listSlots(currentUser(c))),
    )
    .post('/', nameBody, async (c) =>
      c.json(await deps.childService.create(currentUser(c), c.req.valid('json').name), 201),
    )
    .patch('/:id', nameBody, async (c) =>
      c.json(
        await deps.childService.rename(currentUser(c), c.req.param('id'), c.req.valid('json').name),
      ),
    )
    .delete('/:id', async (c) => {
      await deps.childService.delete(currentUser(c), c.req.param('id'))
      return c.body(null, 204)
    })
