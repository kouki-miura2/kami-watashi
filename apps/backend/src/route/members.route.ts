import { Hono } from 'hono'

import type { MemberService } from '../service/member.service.ts'
import { type AppEnv, currentUser, requireOwner } from './context.ts'
import { createDataVersionCache } from './data-version-cache.ts'

export const createMembersRoutes = (deps: {
  memberService: MemberService
  config: { deploymentId: string }
}) =>
  new Hono<AppEnv>()
    .get('/', createDataVersionCache(deps.config), async (c) =>
      c.json(await deps.memberService.listMembers(currentUser(c))),
    )
    .delete('/:id', requireOwner, async (c) => {
      await deps.memberService.removeMember(currentUser(c), c.req.param('id'))
      return c.body(null, 204)
    })
