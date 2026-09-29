import { Hono } from 'hono'

import type { FamilyService } from '../service/family.service.ts'
import { type AppEnv, currentUser, requireOwner } from './context.ts'
import { clearCredentialCookie } from './credential-cookie.ts'

export const createFamilyRoutes = (deps: { familyService: FamilyService }) =>
  // Withdrawal: deletes all of the family's data on the spot.
  new Hono<AppEnv>().delete('/', requireOwner, async (c) => {
    await deps.familyService.withdraw(currentUser(c))
    clearCredentialCookie(c)
    return c.body(null, 204)
  })
