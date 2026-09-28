import type { Context } from 'hono'
import { createMiddleware } from 'hono/factory'
import { LIMITS, charLength } from 'utils'
import { z } from 'zod'

import type { AuthenticatedUser } from '../repository/auth-guard.interface.ts'
import { AppError } from '../service/errors.ts'

/** Hono env shared by the app and every route sub-app. */
export type AppEnv = { Variables: { user: AuthenticatedUser | null; requestId: string } }

/** The authenticated caller. Only for routes behind the auth guard. */
export const currentUser = (c: Context<AppEnv>): AuthenticatedUser => {
  const user = c.get('user')
  if (!user) throw new AppError('unauthorized')
  return user
}

/** Route middleware for owner-only operations (invite, member deletion, withdrawal). */
export const requireOwner = createMiddleware<AppEnv>(async (c, next) => {
  if (!currentUser(c).isOwner) throw new AppError('forbidden')
  await next()
})

/**
 * Hook for every `zValidator(...)`: turns a failed parse into the app's `invalid_input` error
 * (rendered by `onError`) instead of zod-validator's default response body.
 */
export const invalidInput = (result: { success: boolean; error?: { issues: unknown } }): void => {
  if (!result.success) throw new AppError('invalid_input', { issues: result.error?.issues })
}

/** Child name, topic name, or member display name. */
export const nameSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => charLength(value) <= LIMITS.nameMaxLength, {
    message: `At most ${LIMITS.nameMaxLength} characters`,
  })

/** The terms/privacy policy version the member agreed to (checked against the current one by the service). */
export const termsVersionSchema = z.string().trim().min(1).max(64)
