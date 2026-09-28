import { LIMITS, truncateChars } from 'utils'

import { UniqueConstraintError } from '../dao/errors.ts'
import type { AuthenticatedUser } from '../repository/auth-guard.interface.ts'
import type { FamilyRepository } from '../repository/family.repository.ts'
import type { Member, MemberRepository } from '../repository/member.repository.ts'
import { AppError, assertCurrentTerms } from './errors.ts'
import type { GoogleIdentity, GoogleIdTokenVerifier } from './google-id-token.ts'
import { issueSessionToken } from './token.ts'

export interface SessionView {
  sessionToken: string
  /** Unix epoch milliseconds. */
  expiresAt: number
}

export interface LaunchView {
  me: { id: string; name: string; isOwner: boolean }
  /** The current terms/privacy policy version, to show and agree to when `termsAgreed` is false. */
  termsVersion: string
  termsAgreed: boolean
  /** A renewed session for the owner (the session is extended on every launch); `null` for invited members. */
  session: SessionView | null
}

export interface AuthService {
  /**
   * Owner sign-in with a Google ID token. Throws `not_registered` (with `suggestedName`, the
   * Google name cut to the name limit, as details) when the account has no family yet.
   */
  googleLogin: (idToken: string) => Promise<SessionView>
  /** Owner registration: creates the family and its owner, then signs in. */
  register: (input: { idToken: string; name: string; termsVersion: string }) => Promise<SessionView>
  /**
   * Local-development sign-in: `googleLogin`, falling back to `register` with the current terms,
   * minus Google ID token verification.
   */
  devLogin: (input: { googleSub: string; name: string }) => Promise<SessionView>
  /** Called on every app launch: records the access (auto-deletion) and renews the owner session. */
  launch: (user: AuthenticatedUser) => Promise<LaunchView>
}

export const createAuthService = (deps: {
  familyRepository: FamilyRepository
  memberRepository: MemberRepository
  googleIdTokenVerifier: GoogleIdTokenVerifier
  sessionSecret: string
  termsVersion: string
}): AuthService => {
  const issueSession = async (owner: Pick<Member, 'id' | 'familyId'>): Promise<SessionView> => {
    const { token, expiresAt } = await issueSessionToken(
      { memberId: owner.id, familyId: owner.familyId },
      deps.sessionSecret,
    )
    return { sessionToken: token, expiresAt }
  }

  const verifyGoogle = async (idToken: string): Promise<GoogleIdentity> => {
    const identity = await deps.googleIdTokenVerifier.verify(idToken)
    if (!identity) throw new AppError('unauthorized')
    return identity
  }

  const createOwner = async (googleSub: string, name: string): Promise<SessionView> => {
    const owner = { id: crypto.randomUUID(), familyId: crypto.randomUUID() }
    try {
      await deps.familyRepository.createWithOwner({
        familyId: owner.familyId,
        owner: { id: owner.id, name, googleSub },
        termsVersion: deps.termsVersion,
        now: Date.now(),
      })
    } catch (error) {
      // A concurrent registration of the same account won the race on `google_sub`.
      if (error instanceof UniqueConstraintError) throw new AppError('already_registered')
      throw error
    }
    return issueSession(owner)
  }

  return {
    googleLogin: async (idToken) => {
      const identity = await verifyGoogle(idToken)
      const owner = await deps.memberRepository.findByGoogleSub(identity.sub)
      if (!owner) {
        throw new AppError('not_registered', {
          suggestedName: truncateChars(identity.name.trim(), LIMITS.nameMaxLength),
        })
      }
      return issueSession(owner)
    },

    register: async ({ idToken, name, termsVersion }) => {
      assertCurrentTerms(termsVersion, deps.termsVersion)
      const identity = await verifyGoogle(idToken)
      if (await deps.memberRepository.findByGoogleSub(identity.sub)) {
        throw new AppError('already_registered')
      }
      return createOwner(identity.sub, name)
    },

    devLogin: async ({ googleSub, name }) => {
      const existing = await deps.memberRepository.findByGoogleSub(googleSub)
      return existing ? issueSession(existing) : createOwner(googleSub, name)
    },

    launch: async (user) => {
      await deps.familyRepository.touch(user.familyId, Date.now())
      return {
        me: { id: user.id, name: user.name, isOwner: user.isOwner },
        termsVersion: deps.termsVersion,
        termsAgreed: user.termsVersion === deps.termsVersion,
        session: user.isOwner ? await issueSession(user) : null,
      }
    },
  }
}
