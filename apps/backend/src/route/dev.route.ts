import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import type { AuthService } from '../service/auth.service.ts'
import { type AppEnv, invalidInput, nameSchema } from './context.ts'

const LOCAL_HOSTNAMES = ['localhost', '127.0.0.1', '[::1]']

/**
 * Local-development only (see `docs/implementation-plan.md` 2.5). `createApp` mounts these only
 * when `config.devLogin` is on, and they additionally refuse any non-local hostname.
 */
export const createDevRoutes = (deps: { authService: AuthService }) =>
  new Hono<AppEnv>()
    .use('*', async (c, next) => {
      if (!LOCAL_HOSTNAMES.includes(new URL(c.req.url).hostname)) return c.notFound()
      await next()
    })
    .post(
      '/login',
      zValidator(
        'json',
        z.object({ googleSub: z.string().trim().min(1).max(255), name: nameSchema }),
        invalidInput,
      ),
      async (c) => c.json(await deps.authService.devLogin(c.req.valid('json'))),
    )
