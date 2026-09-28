import { Hono } from 'hono'

import type { StatsService } from '../service/stats.service.ts'
import { type AppEnv, currentUser } from './context.ts'

export const createStatsRoutes = (deps: { statsService: StatsService }) =>
  new Hono<AppEnv>().get('/', async (c) => c.json(await deps.statsService.get(currentUser(c))))
