import { Hono } from 'hono'

import type { MemberService } from '../service/member.service.ts'
import { type AppEnv, currentUser, requireOwner } from './context.ts'

export const createMembersRoutes = (deps: { memberService: MemberService }) =>
  new Hono<AppEnv>()
    .get('/', async (c) => c.json(await deps.memberService.listMembers(currentUser(c))))
    .delete('/:id', requireOwner, async (c) => {
      await deps.memberService.removeMember(currentUser(c), c.req.param('id'))
      return c.body(null, 204)
    })
