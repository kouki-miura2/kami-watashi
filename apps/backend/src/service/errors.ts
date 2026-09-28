import { UniqueConstraintError } from '../dao/errors.ts'

/**
 * Outcome codes a service can fail with. The HTTP status for each lives in `app.ts` (`onError`),
 * the only place that knows about HTTP; the code itself is what the client receives as `error`.
 */
export type AppErrorCode =
  | 'invalid_input'
  /** The terms version sent is not the current one (the app showed stale terms). */
  | 'invalid_terms_version'
  /** The invite token is malformed, forged, or its family no longer exists. */
  | 'invalid_invite'
  /** The invite token (QR code) has expired — show a new one. */
  | 'invite_expired'
  | 'unauthorized'
  | 'forbidden'
  | 'terms_required'
  | 'not_found'
  /** Google sign-in succeeded but this account has no family yet — go to registration. */
  | 'not_registered'
  /** This Google account already owns a family. */
  | 'already_registered'
  /** The name is already used in the family. */
  | 'name_taken'
  /** The family already has `LIMITS.familyMembers` members. */
  | 'member_limit'
  /** Saving these photos would exceed the family's storage quota (`LIMITS.familyStorageBytes`). */
  | 'storage_limit'

export class AppError extends Error {
  readonly code: AppErrorCode
  /** Extra JSON-safe context returned to the client alongside `error` (e.g. validation issues). */
  readonly details?: unknown

  constructor(code: AppErrorCode, details?: unknown) {
    super(code)
    this.name = 'AppError'
    this.code = code
    this.details = details
  }
}

/** Registration and joining must agree to the terms version the server currently serves. */
export const assertCurrentTerms = (termsVersion: string, currentTermsVersion: string): void => {
  if (termsVersion !== currentTermsVersion) throw new AppError('invalid_terms_version')
}

/**
 * Name uniqueness, checked up front for a clear error. `except` is the id being renamed, so
 * keeping its own name isn't a conflict.
 */
export const assertNameAvailable = (
  taken: { id: string; name: string }[],
  name: string,
  except?: string,
): void => {
  if (taken.some((item) => item.id !== except && item.name === name)) {
    throw new AppError('name_taken')
  }
}

/** Runs a write whose UNIQUE name constraint can still lose a race, mapping that to `name_taken`. */
export const withNameTaken = async <T>(write: Promise<T>): Promise<T> => {
  try {
    return await write
  } catch (error) {
    if (error instanceof UniqueConstraintError) throw new AppError('name_taken')
    throw error
  }
}
