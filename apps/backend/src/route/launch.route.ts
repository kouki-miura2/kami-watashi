import { Hono } from 'hono'

import type { AuthService } from '../service/auth.service.ts'
import { type AppEnv, currentUser } from './context.ts'
import { readCredential, setMemberKeyCookie, setSessionCookie } from './credential-cookie.ts'

/**
 * Every app launch renews the credential cookie: the owner's with the renewed session, an invited
 * member's (whose key has no expiry) with a fresh lifetime.
 */
export const createLaunchRoutes = (deps: { authService: AuthService }) =>
  new Hono<AppEnv>().post('/', async (c) => {
    const { session, ...launch } = await deps.authService.launch(currentUser(c))
    if (session) setSessionCookie(c, session)
    else setMemberKeyCookie(c, readCredential(c)!)
    return c.json(launch)
  })
