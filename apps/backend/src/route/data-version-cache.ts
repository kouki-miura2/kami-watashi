import { createMiddleware } from 'hono/factory'
import { toJstDateString } from 'utils'

import { type AppEnv, currentUser } from './context.ts'

/**
 * Conditional GET for reads that only change when the family's data does (spec "キャッシュ"), to
 * save D1 rows read. Every write bumps the family's data version (D1 triggers), which the auth
 * guard reads along with the member; while it's unchanged, a browser revalidating its cached copy
 * gets `304` and the route's queries don't run. The ETag also carries:
 * - the deployment, since a new one may change the response's shape;
 * - the member, for the per-member read and mitene states;
 * - the JST date, for today-relative values (this week's counts, the due-date groups, stats).
 *
 * Only for GETs that write nothing and depend on nothing else (not a print's detail, which marks
 * it read, nor time-relative counts like bulk deletion's cutoff).
 */
export const createDataVersionCache = (config: { deploymentId: string }) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const user = currentUser(c)
    const etag = `W/"${config.deploymentId}.${user.dataVersion}.${user.id}.${toJstDateString(new Date())}"`
    // `no-cache`: the browser keeps it, but asks every time (`If-None-Match`) before using it.
    const headers = { etag, 'cache-control': 'private, no-cache' }

    const cached = c.req.header('if-none-match')?.split(',')
    if (cached?.some((tag) => tag.trim() === etag)) return c.body(null, 304, headers)

    await next()
    if (c.res.ok) {
      for (const [name, value] of Object.entries(headers)) c.res.headers.set(name, value)
    }
  })
