import { Hono } from 'hono'

import type { StatsService } from '../service/stats.service.ts'
import { type AppEnv, currentUser } from './context.ts'
import { createDataVersionCache } from './data-version-cache.ts'

export const createStatsRoutes = (deps: {
  statsService: StatsService
  config: { deploymentId: string }
}) =>
  new Hono<AppEnv>().get('/', createDataVersionCache(deps.config), async (c) =>
    c.json(await deps.statsService.get(currentUser(c))),
  )
