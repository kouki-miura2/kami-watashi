/**
 * Thrown by a DAO when a write violates a UNIQUE constraint (e.g. a display name already taken in
 * the family by a concurrent request). Datastore-neutral so services can map it to an outcome
 * without knowing which database raised it.
 */
export class UniqueConstraintError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UniqueConstraintError'
  }
}
