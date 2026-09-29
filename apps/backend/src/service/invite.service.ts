import { LIMITS } from 'utils'

import { UniqueConstraintError } from '../dao/errors.ts'
import type { AuthenticatedUser } from '../repository/auth-guard.interface.ts'
import type { MemberRepository } from '../repository/member.repository.ts'
import { AppError, assertCurrentTerms } from './errors.ts'
import { generateMemberKey, hashMemberKey, issueInviteToken, verifyInviteToken } from './token.ts'

export interface InviteView {
  /** Goes into the QR code. */
  inviteToken: string
  /** Unix epoch milliseconds. */
  expiresAt: number
}

export interface InviteService {
  /** Issues an invite token for the caller's family (owner only — enforced by the route). */
  createInvite: (user: AuthenticatedUser) => Promise<InviteView>
  /**
   * Joins the invite token's family as a new member and returns their member key (the "key
   * file"). The key is returned only here — the server keeps just its hash.
   */
  redeem: (input: {
    inviteToken: string
    name: string
    termsVersion: string
  }) => Promise<{ memberKey: string }>
}

export const createInviteService = (deps: {
  memberRepository: MemberRepository
  sessionSecret: string
  termsVersion: string
}): InviteService => ({
  // Member limit check #1 of 2 (spec): when the QR code is shown.
  createInvite: async (user) => {
    const members = await deps.memberRepository.listByFamily(user.familyId)
    if (members.length >= LIMITS.familyMembers) throw new AppError('member_limit')

    const { token, expiresAt } = await issueInviteToken(user.familyId, deps.sessionSecret)
    return { inviteToken: token, expiresAt }
  },

  // Member limit check #2 of 2 (spec): when the invite token is exchanged for a key.
  redeem: async ({ inviteToken, name, termsVersion }) => {
    const invite = await verifyInviteToken(inviteToken, deps.sessionSecret)
    if (!invite.valid) {
      throw new AppError(invite.reason === 'expired' ? 'invite_expired' : 'invalid_invite')
    }
    assertCurrentTerms(termsVersion, deps.termsVersion)

    // Every family has its owner, so no members means the family has been deleted since.
    const members = await deps.memberRepository.listByFamily(invite.familyId)
    if (members.length === 0) throw new AppError('invalid_invite')
    if (members.length >= LIMITS.familyMembers) throw new AppError('member_limit')
    if (members.some((member) => member.name === name)) throw new AppError('name_taken')

    const memberKey = generateMemberKey()
    let created: boolean
    try {
      created = await deps.memberRepository.createInvited(
        {
          id: crypto.randomUUID(),
          familyId: invite.familyId,
          name,
          keyHash: await hashMemberKey(memberKey),
          termsVersion,
          now: Date.now(),
          maxMembers: LIMITS.familyMembers,
        },
        { memberName: name, target: 'member', action: 'create', name },
      )
    } catch (error) {
      if (error instanceof UniqueConstraintError) throw new AppError('name_taken')
      throw error
    }
    // Another device joined between the check above and the insert.
    if (!created) throw new AppError('member_limit')
    return { memberKey }
  },
})
