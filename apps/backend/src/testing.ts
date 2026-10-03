// Shared test fixtures (`*.test.ts` only — never imported by app code).
import { type AppDependencies, PUBLIC_PATHS, createApp } from './app.ts'
import type { AuthenticatedUser } from './repository/auth-guard.interface.ts'
import type { MemberRepository } from './repository/member.repository.ts'

export const TERMS_VERSION = 'v1'

/** The web app's origin in tests (`config.allowedOrigins`). */
export const WEB_ORIGIN = 'http://localhost:5173'

export const ownerUser: AuthenticatedUser = {
  id: 'owner',
  familyId: 'f1',
  name: '一郎',
  isOwner: true,
  termsVersion: TERMS_VERSION,
  dataVersion: 1,
}

export const invitedUser: AuthenticatedUser = {
  id: 'invited',
  familyId: 'f1',
  name: '二郎',
  isOwner: false,
  termsVersion: TERMS_VERSION,
  dataVersion: 1,
}

const notImplemented = () => {
  throw new Error('not faked in this test')
}

/** A `MemberRepository` fake: pass the methods the test exercises; the rest throw. */
export const fakeMemberRepository = (
  overrides: Partial<MemberRepository> = {},
): MemberRepository => ({
  findById: notImplemented,
  findByKeyHash: notImplemented,
  findByGoogleSub: notImplemented,
  listByFamily: notImplemented,
  createInvited: notImplemented,
  rename: notImplemented,
  agreeTerms: notImplemented,
  delete: notImplemented,
  ...overrides,
})

type Services = Omit<AppDependencies, 'config' | 'auth'>

/**
 * `createApp` with the auth guard on, as in the Worker. `user` is who the fake guard
 * authenticates for any request carrying a credential cookie (`authorized`). Each test fakes only the
 * service methods it exercises; every other method throws.
 */
export const createTestApp = (
  options: {
    /** `null`: the guard rejects every credential (revoked or forged). */
    user?: AuthenticatedUser | null
    config?: Partial<AppDependencies['config']>
    services?: { [Name in keyof Services]?: Partial<Services[Name]> }
  } = {},
) => {
  const user = options.user === undefined ? ownerUser : options.user
  const services = options.services ?? {}
  return createApp({
    config: {
      termsVersion: TERMS_VERSION,
      allowedOrigins: [WEB_ORIGIN],
      devLogin: false,
      deploymentId: 'test-deployment',
      ...options.config,
    },
    auth: {
      guard: {
        authenticate: async () => user,
      },
      enabled: true,
      excludePaths: PUBLIC_PATHS,
    },
    authService: {
      googleLogin: notImplemented,
      register: notImplemented,
      devLogin: notImplemented,
      launch: notImplemented,
      ...services.authService,
    },
    memberService: {
      listMembers: notImplemented,
      rename: notImplemented,
      agreeTerms: notImplemented,
      removeMember: notImplemented,
      leave: notImplemented,
      ...services.memberService,
    },
    inviteService: {
      createInvite: notImplemented,
      redeem: notImplemented,
      ...services.inviteService,
    },
    childService: {
      listSlots: notImplemented,
      create: notImplemented,
      rename: notImplemented,
      delete: notImplemented,
      ...services.childService,
    },
    topicService: {
      list: notImplemented,
      create: notImplemented,
      rename: notImplemented,
      delete: notImplemented,
      ...services.topicService,
    },
    printService: {
      list: notImplemented,
      detail: notImplemented,
      create: notImplemented,
      update: notImplemented,
      replaceImages: notImplemented,
      delete: notImplemented,
      countOld: notImplemented,
      deleteOld: notImplemented,
      getImage: notImplemented,
      ...services.printService,
    },
    miteneService: { send: notImplemented, ...services.miteneService },
    historyService: { list: notImplemented, ...services.historyService },
    statsService: { get: notImplemented, ...services.statsService },
    familyService: {
      withdraw: notImplemented,
      deleteInactive: notImplemented,
      ...services.familyService,
    },
  })
}

/** A request from the web app (`WEB_ORIGIN`) with a credential cookie, as a signed-in browser sends it. */
export const authorized = { headers: { cookie: '__Host-credential=test', origin: WEB_ORIGIN } }
