import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import type { MemberService } from '../service/member.service.ts'
import {
  type AppEnv,
  currentUser,
  invalidInput,
  nameSchema,
  termsVersionSchema,
} from './context.ts'
import { clearCredentialCookie } from './credential-cookie.ts'

export const createMeRoutes = (deps: { memberService: MemberService }) =>
  new Hono<AppEnv>()
    .patch('/', zValidator('json', z.object({ name: nameSchema }), invalidInput), async (c) =>
      c.json(await deps.memberService.rename(currentUser(c), c.req.valid('json').name)),
    )
    .post(
      '/terms',
      zValidator('json', z.object({ termsVersion: termsVersionSchema }), invalidInput),
      async (c) => {
        await deps.memberService.agreeTerms(currentUser(c), c.req.valid('json').termsVersion)
        return c.body(null, 204)
      },
    )
    // Leaving the family (invited members only). Afterwards this browser's key no longer works.
    .delete('/', async (c) => {
      await deps.memberService.leave(currentUser(c))
      clearCredentialCookie(c)
      return c.body(null, 204)
    })
