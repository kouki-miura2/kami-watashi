import { Hono } from 'hono'

import type { AuthService } from '../service/auth.service.ts'
import { type AppEnv, currentUser } from './context.ts'

export const createLaunchRoutes = (deps: { authService: AuthService }) =>
  new Hono<AppEnv>().post('/', async (c) => c.json(await deps.authService.launch(currentUser(c))))
