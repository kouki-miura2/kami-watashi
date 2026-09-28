import { LIMITS } from 'utils'

import type { AuthenticatedUser } from '../repository/auth-guard.interface.ts'
import type {
  History,
  HistoryPosition,
  HistoryRepository,
} from '../repository/history.repository.ts'
import { AppError } from './errors.ts'

/** A history entry with the values at the time of the operation; the app builds the sentence. */
export type HistoryView = Omit<History, 'position'>

export interface HistoryPageView {
  items: HistoryView[]
  /** Pass back as `cursor` for the next (older) page; `null` when this was the last one. */
  nextCursor: string | null
}

export interface HistoryService {
  /** Newest first, `LIMITS.historyPageSize` at a time. */
  list: (user: AuthenticatedUser, cursor?: string) => Promise<HistoryPageView>
}

// Opaque to the client: `<created_at>.<rowid>` of the last entry of the previous page.
const encodeCursor = ({ createdAt, rowid }: HistoryPosition): string => `${createdAt}.${rowid}`

const decodeCursor = (cursor: string): HistoryPosition => {
  const match = /^(\d+)\.(\d+)$/.exec(cursor)
  if (!match) throw new AppError('invalid_input', { field: 'cursor' })
  return { createdAt: Number(match[1]), rowid: Number(match[2]) }
}

export const createHistoryService = (deps: {
  historyRepository: HistoryRepository
}): HistoryService => ({
  list: async (user, cursor) => {
    const pageSize = LIMITS.historyPageSize
    // One extra row tells whether another page follows, without a separate count.
    const rows = await deps.historyRepository.listPage(
      user.familyId,
      cursor === undefined ? null : decodeCursor(cursor),
      pageSize + 1,
    )
    const page = rows.slice(0, pageSize)
    return {
      items: page.map((history) => ({
        id: history.id,
        memberName: history.memberName,
        target: history.target,
        action: history.action,
        name: history.name,
        newName: history.newName,
        printSeq: history.printSeq,
        details: history.details,
        createdAt: history.createdAt,
      })),
      nextCursor: rows.length > pageSize ? encodeCursor(page[page.length - 1].position) : null,
    }
  },
})
