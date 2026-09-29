export interface AuthenticatedUser {
  /** Member id. */
  id: string
  familyId: string
  /** Display name at request time — what history entries record as the operator. */
  name: string
  isOwner: boolean
  /** Version of the terms/privacy policy this member last agreed to. */
  termsVersion: string | null
}

export interface AuthGuard {
  /**
   * Resolves the user a credential (from the credential cookie, see `route/credential-cookie.ts`)
   * belongs to, or `null` if it is invalid or revoked.
   */
  authenticate: (credential: string) => Promise<AuthenticatedUser | null>
}
