import { expect, test, vi } from 'vite-plus/test'

import { createApiErrorHandler } from './error-handler.ts'
import { ApiError } from './errors.ts'

const setup = (auth: { isSignedIn: boolean; isMember: boolean }) => {
  const deps = {
    auth: { ...auth, signOut: vi.fn(async () => {}) },
    router: { replace: vi.fn(async () => undefined) },
    clearCache: vi.fn(),
    notify: vi.fn(),
  }
  return { deps, handle: createApiErrorHandler(deps) }
}

test('a rejected member key signs out and shows the removed screen', async () => {
  const { deps, handle } = setup({ isSignedIn: true, isMember: true })

  await handle(new ApiError('unauthorized', 401), undefined)

  expect(deps.auth.signOut).toHaveBeenCalled()
  expect(deps.router.replace).toHaveBeenCalledWith({ name: 'removed' })
  expect(deps.clearCache).toHaveBeenCalled()
  expect(deps.notify).not.toHaveBeenCalled()
})

test('an expired owner session signs out and goes back to welcome', async () => {
  const { deps, handle } = setup({ isSignedIn: true, isMember: false })

  await handle(new ApiError('unauthorized', 401), undefined)

  expect(deps.auth.signOut).toHaveBeenCalled()
  expect(deps.router.replace).toHaveBeenCalledWith({ name: 'welcome' })
})

test('unauthorized while signed out (e.g. a failed sign-in) is just reported', async () => {
  const { deps, handle } = setup({ isSignedIn: false, isMember: false })

  await handle(new ApiError('unauthorized', 401), undefined)

  expect(deps.auth.signOut).not.toHaveBeenCalled()
  expect(deps.notify).toHaveBeenCalledWith('もう一度ログインしてください')
})

test('terms_required opens the terms screen instead of a snackbar', async () => {
  const { deps, handle } = setup({ isSignedIn: true, isMember: true })

  await handle(new ApiError('terms_required', 403), undefined)

  expect(deps.router.replace).toHaveBeenCalledWith({ name: 'terms' })
  expect(deps.auth.signOut).not.toHaveBeenCalled()
  expect(deps.notify).not.toHaveBeenCalled()
})

test('other errors show their message in the snackbar', async () => {
  const { deps, handle } = setup({ isSignedIn: true, isMember: false })

  await handle(new ApiError('name_taken', 409), undefined)

  expect(deps.notify).toHaveBeenCalledWith('同じ名前がすでにあります')
})

test('skips the snackbar when the caller handles the error', async () => {
  const { deps, handle } = setup({ isSignedIn: true, isMember: false })

  await handle(new ApiError('storage_limit', 413), { handlesError: true })

  expect(deps.notify).not.toHaveBeenCalled()
})
