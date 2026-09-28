import { expect, test } from 'vite-plus/test'

import { ApiError, apiErrorFromResponse, errorMessage } from './errors.ts'

test('apiErrorFromResponse takes the code from the error body', async () => {
  const error = await apiErrorFromResponse(
    Response.json({ error: 'member_limit' }, { status: 409 }),
  )

  expect(error).toEqual(new ApiError('member_limit', 409))
})

test('apiErrorFromResponse falls back to internal_error for an unknown or missing code', async () => {
  const unknown = await apiErrorFromResponse(Response.json({ error: 'teapot' }, { status: 418 }))
  const notJson = await apiErrorFromResponse(new Response('Bad Gateway', { status: 502 }))

  expect(unknown).toEqual(new ApiError('internal_error', 418))
  expect(notJson).toEqual(new ApiError('internal_error', 502))
})

test('errorMessage gives the Japanese message for an ApiError', () => {
  expect(errorMessage(new ApiError('storage_limit', 413))).toBe('容量の上限を超えます')
})

test('errorMessage falls back to a generic message for any other error', () => {
  expect(errorMessage(new Error('boom'))).toBe(
    'エラーが発生しました。時間をおいてもう一度お試しください',
  )
})
