import type { AuthenticatedUser } from '../repository/auth-guard.interface.ts'
import type { MemberRepository } from '../repository/member.repository.ts'
import type { PrintRepository } from '../repository/print.repository.ts'
import { AppError } from './errors.ts'

export interface MiteneService {
  /**
   * Sends "このプリント見てね" to other members of the family. Each recipient's mitene becomes
   * `requested` from the caller, replacing any earlier one (spec: the later mitene wins).
   */
  send: (user: AuthenticatedUser, printId: string, memberIds: string[]) => Promise<void>
}

export const createMiteneService = (deps: {
  printRepository: PrintRepository
  memberRepository: MemberRepository
}): MiteneService => ({
  send: async (user, printId, memberIds) => {
    const recipients = [...new Set(memberIds)]
    // Out of scope in the spec ("自分自身への見てね"), so it's an invalid request, not a no-op.
    if (recipients.includes(user.id)) {
      throw new AppError('invalid_input', { field: 'memberIds', reason: 'self' })
    }

    const [print, members] = await Promise.all([
      deps.printRepository.findInFamily(user.familyId, printId),
      deps.memberRepository.listByFamily(user.familyId),
    ])
    if (!print) throw new AppError('not_found')
    if (!recipients.every((id) => members.some((member) => member.id === id))) {
      throw new AppError('not_found')
    }

    await deps.printRepository.requestMitene(printId, user.id, recipients)
  },
})
