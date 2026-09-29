import type { AppErrorCode } from 'backend/src/service/errors.ts'

/**
 * Error codes a request can fail with: the API's `{ error: code }` codes, plus the ones the client
 * produces itself when there is no usable response.
 */
export type ApiErrorCode =
  | AppErrorCode
  /** The server failed unexpectedly (`500`), or answered without a known error code. */
  | 'internal_error'
  /** The request never got a response (offline, DNS, CORS, ...). */
  | 'network_error'
  /** No response within the client's timeout. */
  | 'timeout'

/** A failed API request. Thrown by `apiClient` for every non-2xx response and network failure. */
export class ApiError extends Error {
  readonly code: ApiErrorCode
  /** HTTP status, or `null` when there was no response. */
  readonly status: number | null
  /** The response's `details`, when the API sends any (e.g. `not_registered`'s `suggestedName`). */
  readonly details?: unknown

  constructor(code: ApiErrorCode, status: number | null, details?: unknown) {
    super(code)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.details = details
  }
}

const messages: Record<ApiErrorCode, string> = {
  invalid_input: '入力内容を確認してください',
  invalid_terms_version: '利用規約が更新されています。アプリを更新してください',
  invalid_invite: 'この招待QRコードは使えません',
  invite_expired: '招待QRコードの有効期限が切れています。新しいQRコードを表示してもらってください',
  unauthorized: 'もう一度ログインしてください',
  forbidden: 'この操作はオーナーだけができます',
  terms_required: '利用規約・プライバシーポリシーへの同意が必要です',
  not_found: '見つかりませんでした。すでに削除されている可能性があります',
  not_registered: 'このGoogleアカウントの家族はまだありません',
  already_registered: 'このGoogleアカウントはすでに家族のオーナーです',
  name_taken: '同じ名前がすでにあります',
  member_limit: '家族のメンバー数が上限に達しています',
  child_limit: 'こどもの人数が上限に達しています',
  topic_limit: 'トピックの数が上限に達しています',
  storage_limit: '容量の上限を超えます',
  internal_error: 'エラーが発生しました。時間をおいてもう一度お試しください',
  network_error: '通信できませんでした。接続を確認してください',
  timeout: '通信がタイムアウトしました。もう一度お試しください',
}

/** Builds the `ApiError` for a non-2xx response from its `{ error: code }` body. */
export const apiErrorFromResponse = async (response: Response): Promise<ApiError> => {
  const body: unknown = await response.json().catch(() => null)
  const fields = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
  const code = String(fields.error)
  return new ApiError(
    Object.hasOwn(messages, code) ? (code as ApiErrorCode) : 'internal_error',
    response.status,
    fields.details,
  )
}

/** User-facing (Japanese) message for any error a query or mutation can fail with. */
export const errorMessage = (error: unknown): string =>
  messages[error instanceof ApiError ? error.code : 'internal_error']
