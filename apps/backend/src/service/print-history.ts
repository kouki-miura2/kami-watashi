import type { ResponseStatus } from '../repository/print.repository.ts'

/** The print items history can show (spec "プリントの項目の表示形式"). */
export interface PrintHistoryFields {
  title: string | null
  /** Topic names at the time of the operation, in display order. */
  topics: string[]
  receivedOn: string | null
  dueOn: string | null
  responseStatus: ResponseStatus
}

type Details = Record<string, unknown>

const orNull = (details: Details): Details | null =>
  Object.keys(details).length > 0 ? details : null

/**
 * Registration (and the "create" half of moving a print): the items that are set. The response
 * status only when it's `todo` or `done` — `none` is the default.
 */
export const createdDetails = (fields: PrintHistoryFields): Details | null =>
  orNull({
    ...(fields.title !== null ? { title: fields.title } : {}),
    ...(fields.topics.length > 0 ? { topics: fields.topics } : {}),
    ...(fields.receivedOn !== null ? { received_on: fields.receivedOn } : {}),
    ...(fields.dueOn !== null ? { due_on: fields.dueOn } : {}),
    ...(fields.responseStatus !== 'none' ? { response_status: fields.responseStatus } : {}),
  })

const sameTopics = (a: string[], b: string[]): boolean =>
  a.length === b.length && a.every((topic) => b.includes(topic))

/** Update: the new value of each item that changed (a cleared item is recorded as null / []). */
export const updatedDetails = (
  before: PrintHistoryFields,
  after: PrintHistoryFields,
): Details | null =>
  orNull({
    ...(after.title !== before.title ? { title: after.title } : {}),
    ...(!sameTopics(after.topics, before.topics) ? { topics: after.topics } : {}),
    ...(after.receivedOn !== before.receivedOn ? { received_on: after.receivedOn } : {}),
    ...(after.dueOn !== before.dueOn ? { due_on: after.dueOn } : {}),
    ...(after.responseStatus !== before.responseStatus
      ? { response_status: after.responseStatus }
      : {}),
  })
