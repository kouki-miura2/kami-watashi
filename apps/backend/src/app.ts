import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { csrf } from 'hono/csrf'
import { HTTPException } from 'hono/http-exception'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { createLogger } from 'utils'

import type { AuthGuard } from './repository/auth-guard.interface.ts'
import { createAuthRoutes } from './route/auth.route.ts'
import { createChildrenRoutes } from './route/children.route.ts'
import { type AppEnv } from './route/context.ts'
import { clearCredentialCookie, readCredential } from './route/credential-cookie.ts'
import { createDevRoutes } from './route/dev.route.ts'
import { createFamilyRoutes } from './route/family.route.ts'
import { createHistoriesRoutes } from './route/histories.route.ts'
import { createImagesRoutes } from './route/images.route.ts'
import { createInvitesRoutes } from './route/invites.route.ts'
import { createLaunchRoutes } from './route/launch.route.ts'
import { createMeRoutes } from './route/me.route.ts'
import { createMembersRoutes } from './route/members.route.ts'
import { createPrintsRoutes } from './route/prints.route.ts'
import { createStatsRoutes } from './route/stats.route.ts'
import { createTopicsRoutes } from './route/topics.route.ts'
import type { AuthService } from './service/auth.service.ts'
import type { ChildService } from './service/child.service.ts'
import { AppError, type AppErrorCode } from './service/errors.ts'
import type { FamilyService } from './service/family.service.ts'
import type { HistoryService } from './service/history.service.ts'
import type { InviteService } from './service/invite.service.ts'
import type { MemberService } from './service/member.service.ts'
import type { MiteneService } from './service/mitene.service.ts'
import type { PrintService } from './service/print.service.ts'
import type { StatsService } from './service/stats.service.ts'
import type { TopicService } from './service/topic.service.ts'

export interface AuthConfig {
  guard: AuthGuard
  /** Off by default (free access). When on, applies to every route except `excludePaths`. */
  enabled: boolean
  excludePaths: string[]
}

export interface AppConfig {
  /** Current terms/privacy policy version. Members who agreed to an older one get `terms_required`. */
  termsVersion: string
  /**
   * Origins besides the API's own that serve the web app: the CORS allow-list, and — with the API's
   * own origin — the only origins whose requests may change state (CSRF, see `createApp`). Empty
   * when the web app is served from the same origin as the API (as deployed).
   */
  allowedOrigins: string[]
  /** Mounts `/dev/*` (local-only sign-in). Must never be on in a deployed Worker. */
  devLogin: boolean
}

export interface AppDependencies {
  config: AppConfig
  auth: AuthConfig
  authService: AuthService
  memberService: MemberService
  inviteService: InviteService
  childService: ChildService
  topicService: TopicService
  printService: PrintService
  miteneService: MiteneService
  historyService: HistoryService
  statsService: StatsService
  familyService: FamilyService
}

/** Paths reachable without credentials — pass as `auth.excludePaths`. */
export const PUBLIC_PATHS = [
  '/auth/google',
  '/auth/google/register',
  '/invites/redeem',
  '/dev/login',
]

/** Reachable with outdated terms, so the app can launch and ask for agreement again. */
const TERMS_EXEMPT_PATHS = ['/launch', '/me/terms']

const statusByErrorCode: Record<AppErrorCode, ContentfulStatusCode> = {
  invalid_input: 400,
  invalid_terms_version: 400,
  invalid_invite: 400,
  invite_expired: 400,
  unauthorized: 401,
  forbidden: 403,
  terms_required: 403,
  not_found: 404,
  not_registered: 404,
  already_registered: 409,
  name_taken: 409,
  member_limit: 409,
  child_limit: 409,
  topic_limit: 409,
  storage_limit: 413,
}

// 4 random bytes as hex: short enough to scan by eye in logs, still ~4 billion values so
// collisions within one log stream are practically a non-issue.
const generateRequestId = (): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(4)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')

/** Runtime-agnostic app: no Cloudflare Workers or Node-specific APIs here. Entrypoints live in the runtime package (`apps/backend-*`). */
export const createApp = (deps: AppDependencies) => {
  const logger = createLogger({ format: 'json' })

  const app = new Hono<AppEnv>()
    // The credential is a cookie (`route/credential-cookie.ts`), so the web app's other origins may
    // send it (`credentials`). CSRF: a JSON request from another origin fails the CORS preflight;
    // `csrf` refuses the rest (form-like bodies, or none), which need no preflight, unless they come
    // from the API's own origin or an allowed one.
    .use('*', cors({ origin: deps.config.allowedOrigins, credentials: true }))
    .use(
      '*',
      csrf({
        origin: (origin, c) =>
          origin === new URL(c.req.url).origin || deps.config.allowedOrigins.includes(origin),
      }),
    )
    // Audit trail: start/end pair per request, joined by requestId (needed since concurrent
    // requests to the same method+path would otherwise be indistinguishable in the log stream).
    // Wraps the auth guard so a rejected (401) request is still logged, not just successful ones.
    .use('*', async (c, next) => {
      const requestId = generateRequestId()
      c.set('requestId', requestId)
      const startedAt = Date.now()

      logger.info('request started', { requestId, method: c.req.method, path: c.req.path })

      try {
        await next()
      } finally {
        logger.info('request completed', {
          requestId,
          method: c.req.method,
          path: c.req.path,
          user: c.get('user')?.id ?? 'anonymous',
          status: c.res.status,
          durationMs: Date.now() - startedAt,
        })
      }
    })
    // API responses reflect per-member state (read/mitene) and must not be served from a cache.
    // A route that is safe to cache (images) sets its own Cache-Control.
    .use('*', async (c, next) => {
      await next()
      if (!c.res.headers.has('cache-control')) c.res.headers.set('cache-control', 'no-store')
    })
    .use('*', async (c, next) => {
      if (deps.auth.enabled && !deps.auth.excludePaths.includes(c.req.path)) {
        const credential = readCredential(c)
        const user = credential ? await deps.auth.guard.authenticate(credential) : null
        if (!user) {
          // A credential that no longer works (member removed, family deleted, session expired).
          if (credential) clearCredentialCookie(c)
          return c.json({ error: 'unauthorized' }, 401)
        }
        c.set('user', user)
      } else {
        c.set('user', null)
      }
      await next()
    })
    .use('*', async (c, next) => {
      const user = c.get('user')
      if (
        user &&
        user.termsVersion !== deps.config.termsVersion &&
        !TERMS_EXEMPT_PATHS.includes(c.req.path)
      ) {
        throw new AppError('terms_required')
      }
      await next()
    })
    .route('/auth', createAuthRoutes(deps))
    .route('/launch', createLaunchRoutes(deps))
    .route('/me', createMeRoutes(deps))
    .route('/members', createMembersRoutes(deps))
    .route('/invites', createInvitesRoutes(deps))
    .route('/children', createChildrenRoutes(deps))
    .route('/topics', createTopicsRoutes(deps))
    .route('/prints', createPrintsRoutes(deps))
    .route('/images', createImagesRoutes(deps))
    .route('/histories', createHistoriesRoutes(deps))
    .route('/stats', createStatsRoutes(deps))
    .route('/family', createFamilyRoutes(deps))

  app.notFound((c) => c.json({ error: 'not_found' }, 404))
  app.onError((error, c) => {
    // Hono's own refusals (`csrf`'s 403).
    if (error instanceof HTTPException) return error.getResponse()
    if (error instanceof AppError) {
      return c.json(
        { error: error.code, ...(error.details ? { details: error.details } : {}) },
        statusByErrorCode[error.code],
      )
    }
    logger.error('unhandled error', {
      requestId: c.get('requestId'),
      error: error instanceof Error ? (error.stack ?? error.message) : String(error),
    })
    return c.json({ error: 'internal_error' }, 500)
  })

  // Mounted outside the chain on purpose: `/dev/*` is not part of `AppType` (the frontend never
  // calls it) and doesn't exist at all unless `devLogin` is on.
  if (deps.config.devLogin) app.route('/dev', createDevRoutes(deps))

  return app
}

/** Hono RPC contract consumed by `apps/frontend` via `hc<AppType>()`. */
export type AppType = ReturnType<typeof createApp>
