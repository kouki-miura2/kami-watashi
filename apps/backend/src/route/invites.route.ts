import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import type { InviteService } from '../service/invite.service.ts'
import {
  type AppEnv,
  currentUser,
  invalidInput,
  nameSchema,
  requireOwner,
  termsVersionSchema,
} from './context.ts'
import { setMemberKeyCookie } from './credential-cookie.ts'

export const createInvitesRoutes = (deps: { inviteService: InviteService }) =>
  new Hono<AppEnv>()
    .post('/', requireOwner, async (c) =>
      c.json(await deps.inviteService.createInvite(currentUser(c))),
    )
    // Public (listed in `PUBLIC_PATHS`): the joining browser has no credential yet. The member key
    // goes in the credential cookie.
    .post(
      '/redeem',
      zValidator(
        'json',
        z.object({
          inviteToken: z.string().min(1),
          name: nameSchema,
          termsVersion: termsVersionSchema,
        }),
        invalidInput,
      ),
      async (c) => {
        setMemberKeyCookie(c, (await deps.inviteService.redeem(c.req.valid('json'))).memberKey)
        return c.body(null, 204)
      },
    )
