export interface CreateFamilyWithOwnerInput {
  familyId: string
  ownerId: string
  ownerName: string
  googleSub: string
  termsVersion: string
  /** Unix epoch milliseconds; used for `last_accessed_at` and `terms_agreed_at`. */
  now: number
}

export interface FamilyDao {
  /** Creates the family and its owner atomically. Throws `UniqueConstraintError` if `googleSub` already owns a family. */
  createWithOwner: (input: CreateFamilyWithOwnerInput) => Promise<void>
  /** Records an app launch (`last_accessed_at`), which keeps the family from auto-deletion. */
  touch: (familyId: string, now: number) => Promise<void>
  /** Families not launched since `before` (Unix ms), oldest first, at most `limit`. */
  listInactive: (before: number, limit: number) => Promise<string[]>
  /** Deletes the family row; every other row of the family goes with it by cascade. */
  delete: (familyId: string) => Promise<void>
}
