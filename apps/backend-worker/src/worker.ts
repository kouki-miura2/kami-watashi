import { PUBLIC_PATHS, createApp } from 'backend/src/app.ts'
import { createTokenAuthGuard } from 'backend/src/repository/auth-guard.token.ts'
import { createChildRepository } from 'backend/src/repository/child.repository.ts'
import { createFamilyRepository } from 'backend/src/repository/family.repository.ts'
import { createHistoryRepository } from 'backend/src/repository/history.repository.ts'
import { createImageRepository } from 'backend/src/repository/image.repository.ts'
import { createMemberRepository } from 'backend/src/repository/member.repository.ts'
import { createPrintRepository } from 'backend/src/repository/print.repository.ts'
import { createTopicRepository } from 'backend/src/repository/topic.repository.ts'
import { createAuthService } from 'backend/src/service/auth.service.ts'
import { createChildService } from 'backend/src/service/child.service.ts'
import { createFamilyService } from 'backend/src/service/family.service.ts'
import { createGoogleIdTokenVerifier } from 'backend/src/service/google-id-token.ts'
import { createHistoryService } from 'backend/src/service/history.service.ts'
import { createInviteService } from 'backend/src/service/invite.service.ts'
import { createMemberService } from 'backend/src/service/member.service.ts'
import { createMiteneService } from 'backend/src/service/mitene.service.ts'
import { createPrintService } from 'backend/src/service/print.service.ts'
import { createStatsService } from 'backend/src/service/stats.service.ts'
import { createTopicService } from 'backend/src/service/topic.service.ts'
import { env } from 'cloudflare:workers'

import { createChildD1Dao } from './dao/child.d1.ts'
import { createFamilyD1Dao } from './dao/family.d1.ts'
import { createHistoryD1Dao } from './dao/history.d1.ts'
import { createR2ImageStorage } from './dao/image-storage.r2.ts'
import { createMemberD1Dao } from './dao/member.d1.ts'
import { createPrintD1Dao } from './dao/print.d1.ts'
import { createTopicD1Dao } from './dao/topic.d1.ts'

// Secrets and `.dev.vars`-only values: declared here rather than relying on `wrangler types`, which
// only sees them on machines that have a `.dev.vars`.
const { SESSION_SECRET, DEV_LOGIN_ENABLED } = env as Env & {
  SESSION_SECRET?: string
  DEV_LOGIN_ENABLED?: string
}
if (!SESSION_SECRET) {
  throw new Error('SESSION_SECRET is not set (wrangler secret put SESSION_SECRET / .dev.vars)')
}

const splitList = (value: string): string[] =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

const familyRepository = createFamilyRepository(createFamilyD1Dao(env.DB))
const memberRepository = createMemberRepository(createMemberD1Dao(env.DB))
const childRepository = createChildRepository(createChildD1Dao(env.DB))
const topicRepository = createTopicRepository(createTopicD1Dao(env.DB))
const imageRepository = createImageRepository(createR2ImageStorage(env.IMAGES))
const printRepository = createPrintRepository(createPrintD1Dao(env.DB))

const familyService = createFamilyService({ familyRepository, imageRepository })

const app = createApp({
  config: {
    termsVersion: env.TERMS_VERSION,
    allowedOrigins: splitList(env.ALLOWED_ORIGINS),
    deploymentId: env.CF_VERSION_METADATA.id,
    devLogin: DEV_LOGIN_ENABLED === 'true',
  },
  auth: {
    guard: createTokenAuthGuard({ sessionSecret: SESSION_SECRET, memberRepository }),
    enabled: true,
    excludePaths: PUBLIC_PATHS,
  },
  authService: createAuthService({
    familyRepository,
    memberRepository,
    googleIdTokenVerifier: createGoogleIdTokenVerifier({
      clientIds: splitList(env.GOOGLE_CLIENT_IDS),
    }),
    sessionSecret: SESSION_SECRET,
    termsVersion: env.TERMS_VERSION,
  }),
  memberService: createMemberService({ memberRepository, termsVersion: env.TERMS_VERSION }),
  inviteService: createInviteService({
    memberRepository,
    sessionSecret: SESSION_SECRET,
    termsVersion: env.TERMS_VERSION,
  }),
  childService: createChildService({ childRepository, imageRepository }),
  topicService: createTopicService({ topicRepository }),
  printService: createPrintService({
    printRepository,
    childRepository,
    topicRepository,
    imageRepository,
  }),
  miteneService: createMiteneService({ printRepository, memberRepository }),
  historyService: createHistoryService({
    historyRepository: createHistoryRepository(createHistoryD1Dao(env.DB)),
  }),
  statsService: createStatsService({ printRepository, childRepository }),
  familyService,
})

/**
 * This Worker also serves the web app (`assets` in wrangler.jsonc): the API lives under `/api`, on
 * the same origin, so the browser sends the sign-in cookie as a first-party one (spec
 * "アーキテクチャ"). Only `/api/*` reaches this code; everything else is a static asset. The prefix
 * is taken off before the app sees the request, so its routes (and path lists like `PUBLIC_PATHS`)
 * stay prefix-free.
 */
const API_PREFIX = '/api'

export default {
  fetch: (request, workerEnv, ctx) => {
    const url = new URL(request.url)
    url.pathname = url.pathname.slice(API_PREFIX.length) || '/'
    return app.fetch(new Request(url, request), workerEnv, ctx)
  },
  // The Cron Trigger in wrangler.jsonc: auto-deletion of inactive families.
  scheduled: async (_controller, _env, ctx) => {
    ctx.waitUntil(familyService.deleteInactive())
  },
} satisfies ExportedHandler<Env>
