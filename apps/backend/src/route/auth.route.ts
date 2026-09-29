import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import type { AuthService } from '../service/auth.service.ts'
import { type AppEnv, invalidInput, nameSchema, termsVersionSchema } from './context.ts'
import { setSessionCookie } from './credential-cookie.ts'

const idTokenSchema = z.string().min(1)

/** Owner sign-in and registration. Public: listed in `PUBLIC_PATHS`. The session goes in the credential cookie. */
export const createAuthRoutes = (deps: { authService: AuthService }) =>
  new Hono<AppEnv>()
    .post(
      '/google',
      zValidator('json', z.object({ idToken: idTokenSchema }), invalidInput),
      async (c) => {
        setSessionCookie(c, await deps.authService.googleLogin(c.req.valid('json').idToken))
        return c.body(null, 204)
      },
    )
    .post(
      '/google/register',
      zValidator(
        'json',
        z.object({ idToken: idTokenSchema, name: nameSchema, termsVersion: termsVersionSchema }),
        invalidInput,
      ),
      async (c) => {
        setSessionCookie(c, await deps.authService.register(c.req.valid('json')))
        return c.body(null, 204)
      },
    )
