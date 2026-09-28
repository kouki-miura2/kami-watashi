import { LIMITS, createLogger } from 'utils'

import type { AuthenticatedUser } from '../repository/auth-guard.interface.ts'
import type { FamilyRepository } from '../repository/family.repository.ts'
import type { ImageRepository } from '../repository/image.repository.ts'
import { AppError } from './errors.ts'

export interface FamilyService {
  /**
   * The owner withdraws (owner-only — also enforced by the route): the family's data is deleted
   * on the spot, and every member's key and the owner's session stop working.
   */
  withdraw: (user: AuthenticatedUser) => Promise<void>
  /**
   * Scheduled: deletes families whose members haven't launched the app for
   * `LIMITS.autoDeleteDays`. Oldest first, at most `MAX_FAMILIES_PER_RUN` per run — the rest
   * are picked up by the next run.
   */
  deleteInactive: () => Promise<{ deleted: number; failed: number }>
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Keeps one scheduled run well within the Worker's time limits. */
export const MAX_FAMILIES_PER_RUN = 100

const logger = createLogger({ format: 'json' })

export const createFamilyService = (deps: {
  familyRepository: FamilyRepository
  imageRepository: ImageRepository
}): FamilyService => {
  /**
   * Unlike deleting a print, the photos go first: once the family row is gone nothing would lead
   * back to leftover objects, and the spec promises they're deleted. If R2 fails, nothing has
   * changed yet and the deletion can simply be retried. The second pass catches a photo uploaded
   * by another member while this ran.
   */
  const deleteFamily = async (familyId: string): Promise<void> => {
    await deps.imageRepository.deleteFamilyImages(familyId)
    await deps.familyRepository.delete(familyId)
    try {
      await deps.imageRepository.deleteFamilyImages(familyId)
    } catch (error) {
      logger.error('failed to sweep images of a deleted family', {
        familyId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return {
    withdraw: async (user) => {
      if (!user.isOwner) throw new AppError('forbidden')
      await deleteFamily(user.familyId)
    },

    deleteInactive: async () => {
      const cutoff = Date.now() - LIMITS.autoDeleteDays * DAY_MS
      const familyIds = await deps.familyRepository.listInactive(cutoff, MAX_FAMILIES_PER_RUN)
      let failed = 0
      for (const familyId of familyIds) {
        try {
          await deleteFamily(familyId)
        } catch (error) {
          failed++
          logger.error('failed to auto-delete an inactive family', {
            familyId,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }
      const result = { deleted: familyIds.length - failed, failed }
      logger.info('auto-deleted inactive families', result)
      return result
    },
  }
}
