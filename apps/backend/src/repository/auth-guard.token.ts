import { hashMemberKey, isMemberKey, verifySessionToken } from '../service/token.ts'
import type { AuthGuard } from './auth-guard.interface.ts'
import type { Member, MemberRepository } from './member.repository.ts'

const BEARER_PREFIX = 'Bearer '

/**
 * `Authorization: Bearer <credential>`, where the credential is either an owner's session token
 * (signed JWT) or an invited member's key (`mk_...`). Either way the member row is looked up on
 * every request, so deleting a member (or the whole family) revokes their credential immediately.
 */
export const createTokenAuthGuard = (deps: {
  sessionSecret: string
  memberRepository: MemberRepository
}): AuthGuard => {
  const findMember = async (credential: string): Promise<Member | null> => {
    if (isMemberKey(credential)) {
      return deps.memberRepository.findByKeyHash(await hashMemberKey(credential))
    }
    const claims = await verifySessionToken(credential, deps.sessionSecret)
    if (!claims) return null
    const member = await deps.memberRepository.findById(claims.memberId)
    // Sessions are only ever issued to owners; anything else is a stale or forged claim.
    return member?.isOwner && member.familyId === claims.familyId ? member : null
  }

  return {
    authenticate: async (request) => {
      const header = request.headers.get('authorization')
      if (!header?.startsWith(BEARER_PREFIX)) return null
      const credential = header.slice(BEARER_PREFIX.length).trim()
      if (!credential) return null

      const member = await findMember(credential)
      return member
        ? {
            id: member.id,
            familyId: member.familyId,
            name: member.name,
            isOwner: member.isOwner,
            termsVersion: member.termsVersion,
          }
        : null
    },
  }
}
