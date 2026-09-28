import { UniqueConstraintError } from 'backend/src/dao/errors.ts'

/**
 * `.catch()` handler for D1 writes: turns SQLite's "UNIQUE constraint failed" into the
 * datastore-neutral `UniqueConstraintError` services understand, and rethrows anything else.
 */
export const rethrowUniqueConstraint = (error: unknown): never => {
  if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
    throw new UniqueConstraintError(error.message)
  }
  throw error
}
