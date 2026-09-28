import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import type { AuthService } from '../service/auth.service.ts'
import { type AppEnv, invalidInput, nameSchema, termsVersionSchema } from './context.ts'

const idTokenSchema = z.string().min(1)

/** Owner sign-in and registration. Public: listed in `PUBLIC_PATHS`. */
export const createAuthRoutes = (deps: { authService: AuthService }) =>
  new Hono<AppEnv>()
    .post(
      '/google',
      zValidator('json', z.object({ idToken: idTokenSchema }), invalidInput),
      async (c) => c.json(await deps.authService.googleLogin(c.req.valid('json').idToken)),
    )
    .post(
      '/google/register',
      zValidator(
        'json',
        z.object({ idToken: idTokenSchema, name: nameSchema, termsVersion: termsVersionSchema }),
        invalidInput,
      ),
      async (c) => c.json(await deps.authService.register(c.req.valid('json'))),
    )
