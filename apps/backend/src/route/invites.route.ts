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

export const createInvitesRoutes = (deps: { inviteService: InviteService }) =>
  new Hono<AppEnv>()
    .post('/', requireOwner, async (c) =>
      c.json(await deps.inviteService.createInvite(currentUser(c))),
    )
    // Public (listed in `PUBLIC_PATHS`): the joining device has no credential yet.
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
      async (c) => c.json(await deps.inviteService.redeem(c.req.valid('json'))),
    )
