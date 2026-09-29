import { createLogger, LIMITS, startOfJstWeek } from 'utils'

import type { AuthenticatedUser } from '../repository/auth-guard.interface.ts'
import type { Child, ChildRepository, SlotCount } from '../repository/child.repository.ts'
import type { ImageRepository } from '../repository/image.repository.ts'
import { AppError, assertNameAvailable, withNameTaken } from './errors.ts'

/** The family-common slot's name: reserved as a child name and recorded in print history. */
export const COMMON_SLOT_NAME = '家族共通'

export interface ChildView {
  id: string
  name: string
}

/** A row of the child list: a child, or the family-common slot (`id: null`). */
export interface ChildSlotView {
  id: string | null
  name: string
  /** Prints registered this week (JST calendar week starting Monday). */
  weekCount: number
  /** The caller's mitene badge: prints whose mitene status for them is `requested`. */
  miteneCount: number
}

export interface ChildService {
  /** The family-common slot first, then children in registration order. */
  listSlots: (user: AuthenticatedUser) => Promise<ChildSlotView[]>
  create: (user: AuthenticatedUser, name: string) => Promise<ChildView>
  rename: (user: AuthenticatedUser, id: string, name: string) => Promise<ChildView>
  /** Deletes the child with all their prints and photos. */
  delete: (user: AuthenticatedUser, id: string) => Promise<void>
}

const logger = createLogger({ format: 'json' })

const countOf = (counts: SlotCount[], childId: string | null): number =>
  counts.find((slot) => slot.childId === childId)?.count ?? 0

export const createChildService = (deps: {
  childRepository: ChildRepository
  imageRepository: ImageRepository
}): ChildService => {
  const findChild = async (user: AuthenticatedUser, id: string): Promise<Child> => {
    const child = await deps.childRepository.findInFamily(user.familyId, id)
    if (!child) throw new AppError('not_found')
    return child
  }

  const assertChildNameAvailable = (children: Child[], name: string, except?: string): void => {
    if (name === COMMON_SLOT_NAME) throw new AppError('name_taken')
    assertNameAvailable(children, name, except)
  }

  return {
    listSlots: async (user) => {
      const [children, weekCounts, miteneCounts] = await Promise.all([
        deps.childRepository.listByFamily(user.familyId),
        deps.childRepository.countPrintsSince(user.familyId, startOfJstWeek(new Date()).getTime()),
        deps.childRepository.countMiteneRequested(user.id),
      ])
      return [{ id: null, name: COMMON_SLOT_NAME }, ...children].map(({ id, name }) => ({
        id,
        name,
        weekCount: countOf(weekCounts, id),
        miteneCount: countOf(miteneCounts, id),
      }))
    },

    create: async (user, name) => {
      const children = await deps.childRepository.listByFamily(user.familyId)
      if (children.length >= LIMITS.familyChildren) throw new AppError('child_limit')
      assertChildNameAvailable(children, name)
      const child = { id: crypto.randomUUID(), familyId: user.familyId, name }
      await withNameTaken(
        deps.childRepository.create(
          child,
          { memberName: user.name, target: 'child', action: 'create', name },
          Date.now(),
        ),
      )
      return { id: child.id, name }
    },

    rename: async (user, id, name) => {
      const child = await findChild(user, id)
      if (name === child.name) return { id, name }

      assertChildNameAvailable(await deps.childRepository.listByFamily(user.familyId), name, id)
      await withNameTaken(
        deps.childRepository.rename(
          child,
          name,
          {
            memberName: user.name,
            target: 'child',
            action: 'update',
            name: child.name,
            newName: name,
          },
          Date.now(),
        ),
      )
      return { id, name }
    },

    delete: async (user, id) => {
      const child = await findChild(user, id)
      // Read before the delete: the rows are gone afterwards. A print registered in between is
      // deleted too (cascade) but not counted, and its photos are left in R2 until the family is
      // deleted — acceptable for a family-sized app.
      const [printCount, images] = await Promise.all([
        deps.childRepository.countPrints(id),
        deps.childRepository.listImages(id),
      ])
      await deps.childRepository.delete(
        child,
        {
          memberName: user.name,
          target: 'child',
          action: 'delete',
          name: child.name,
          details: { print_count: printCount },
        },
        Date.now(),
      )
      try {
        await deps.imageRepository.deleteImages(user.familyId, images)
      } catch (error) {
        // The rows are already gone, so leftover objects no longer count against the quota.
        logger.error('failed to delete images of a deleted child', {
          childId: id,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    },
  }
}
