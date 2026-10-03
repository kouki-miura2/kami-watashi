import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import type { HistoryService } from '../service/history.service.ts'
import { type AppEnv, currentUser, invalidInput } from './context.ts'
import { createDataVersionCache } from './data-version-cache.ts'

export const createHistoriesRoutes = (deps: {
  historyService: HistoryService
  config: { deploymentId: string }
}) =>
  new Hono<AppEnv>().get(
    '/',
    createDataVersionCache(deps.config),
    zValidator(
      'query',
      /** `cursor`: the previous page's `nextCursor`; omit for the newest page. */
      z.object({ cursor: z.string().min(1).optional() }),
      invalidInput,
    ),
    async (c) =>
      c.json(await deps.historyService.list(currentUser(c), c.req.valid('query').cursor)),
  )
