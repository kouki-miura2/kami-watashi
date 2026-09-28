import type { AuthenticatedUser } from '../repository/auth-guard.interface.ts'
import type { MemberRepository } from '../repository/member.repository.ts'
import { AppError, assertCurrentTerms, assertNameAvailable, withNameTaken } from './errors.ts'

export interface MemberView {
  id: string
  name: string
  isOwner: boolean
  isMe: boolean
}

export interface MemberService {
  /** Members of the caller's family: the owner first, then by name. */
  listMembers: (user: AuthenticatedUser) => Promise<MemberView[]>
  /** Changes the caller's display name (unique in the family) and records it in the history. */
  rename: (user: AuthenticatedUser, name: string) => Promise<{ id: string; name: string }>
  /** Records the caller's agreement to the current terms/privacy policy. */
  agreeTerms: (user: AuthenticatedUser, termsVersion: string) => Promise<void>
  /**
   * The owner removes an invited member (owner-only — enforced by the route). The member's key
   * stops working immediately and the mitene they sent are withdrawn.
   */
  removeMember: (user: AuthenticatedUser, memberId: string) => Promise<void>
  /** An invited member leaves the family. The owner can't: they withdraw instead (`DELETE /family`). */
  leave: (user: AuthenticatedUser) => Promise<void>
}

export const createMemberService = (deps: {
  memberRepository: MemberRepository
  termsVersion: string
}): MemberService => ({
  listMembers: async (user) => {
    const members = await deps.memberRepository.listByFamily(user.familyId)
    return members
      .toSorted(
        (a, b) => Number(b.isOwner) - Number(a.isOwner) || a.name.localeCompare(b.name, 'ja'),
      )
      .map((member) => ({
        id: member.id,
        name: member.name,
        isOwner: member.isOwner,
        isMe: member.id === user.id,
      }))
  },

  rename: async (user, name) => {
    if (name === user.name) return { id: user.id, name }

    assertNameAvailable(await deps.memberRepository.listByFamily(user.familyId), name, user.id)
    await withNameTaken(
      deps.memberRepository.rename(
        user,
        name,
        {
          memberName: user.name,
          target: 'member',
          action: 'update',
          name: user.name,
          newName: name,
        },
        Date.now(),
      ),
    )
    return { id: user.id, name }
  },

  agreeTerms: async (user, termsVersion) => {
    assertCurrentTerms(termsVersion, deps.termsVersion)
    await deps.memberRepository.agreeTerms(user.id, termsVersion, Date.now())
  },

  removeMember: async (user, memberId) => {
    const members = await deps.memberRepository.listByFamily(user.familyId)
    const member = members.find((candidate) => candidate.id === memberId)
    if (!member) throw new AppError('not_found')
    if (member.isOwner) throw new AppError('forbidden')
    await deps.memberRepository.delete(member.id)
  },

  leave: async (user) => {
    if (user.isOwner) throw new AppError('forbidden')
    await deps.memberRepository.delete(user.id)
  },
})
