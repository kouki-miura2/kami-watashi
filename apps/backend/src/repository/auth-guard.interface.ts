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
  /** Resolves the authenticated user from a request, or `null` if unauthenticated. */
  authenticate: (request: Request) => Promise<AuthenticatedUser | null>
}
