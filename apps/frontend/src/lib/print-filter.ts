import type { LocationQuery } from 'vue-router'

export type ResponseStatus = 'none' | 'todo' | 'done'
export type MiteneStatus = 'none' | 'requested' | 'seen'
export type ReadFilter = 'unread' | 'read'

/** A print list's order and filters (2b/2c/2d). Kept in the URL query so back/links restore it. */
export interface PrintFilter {
  sort: 'created' | 'due'
  /** Prints having all of these topics. */
  topicIds: string[]
  read?: ReadFilter
  response?: ResponseStatus
  mitene?: MiteneStatus
}

export const EMPTY_FILTER: PrintFilter = { sort: 'created', topicIds: [] }

const RESPONSE_LABELS: Record<ResponseStatus, string> = {
  none: '不要',
  todo: '未対応',
  done: '対応済',
}
const MITENE_LABELS: Record<MiteneStatus, string> = {
  none: '見てねなし',
  requested: '見てね',
  seen: '見たよ',
}
const READ_LABELS: Record<ReadFilter, string> = { unread: '未読', read: '既読' }

export const responseLabel = (status: ResponseStatus): string => RESPONSE_LABELS[status]

const pick = <T extends string>(value: unknown, allowed: readonly T[]): T | undefined =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined

/** Reads the filter from the route query, ignoring anything unknown. */
export const filterFromQuery = (query: LocationQuery): PrintFilter => ({
  sort: pick(query.sort, ['created', 'due'] as const) ?? 'created',
  topicIds:
    typeof query.topics === 'string' ? query.topics.split(',').filter((id) => id !== '') : [],
  read: pick(query.read, ['unread', 'read'] as const),
  response: pick(query.response, ['none', 'todo', 'done'] as const),
  mitene: pick(query.mitene, ['none', 'requested', 'seen'] as const),
})

/** The route query for a filter, leaving defaults out so plain URLs stay plain. */
export const filterToQuery = (filter: PrintFilter): Record<string, string> => {
  const query: Record<string, string> = {}
  if (filter.sort !== 'created') query.sort = filter.sort
  if (filter.topicIds.length > 0) query.topics = filter.topicIds.join(',')
  if (filter.read) query.read = filter.read
  if (filter.response) query.response = filter.response
  if (filter.mitene) query.mitene = filter.mitene
  return query
}

/** `GET /prints` query parameters for a slot and filter. */
export const toApiQuery = (slot: string, filter: PrintFilter) => ({
  child: slot,
  sort: filter.sort,
  ...(filter.topicIds.length > 0 ? { topicIds: filter.topicIds.join(',') } : {}),
  ...(filter.read ? { read: filter.read } : {}),
  ...(filter.response ? { response: filter.response } : {}),
  ...(filter.mitene ? { mitene: filter.mitene } : {}),
})

export type FilterCondition =
  | { kind: 'topic'; topicId: string }
  | { kind: 'read' | 'response' | 'mitene' }

/** The active conditions as chips (the list's chip row), each removable on its own. */
export const activeConditions = (
  filter: PrintFilter,
  topicName: (id: string) => string | undefined,
): { condition: FilterCondition; label: string }[] => [
  ...(filter.mitene
    ? [{ condition: { kind: 'mitene' as const }, label: MITENE_LABELS[filter.mitene] }]
    : []),
  ...(filter.read
    ? [{ condition: { kind: 'read' as const }, label: READ_LABELS[filter.read] }]
    : []),
  ...(filter.response
    ? [{ condition: { kind: 'response' as const }, label: RESPONSE_LABELS[filter.response] }]
    : []),
  ...filter.topicIds.flatMap((topicId) => {
    const name = topicName(topicId)
    return name ? [{ condition: { kind: 'topic' as const, topicId }, label: name }] : []
  }),
]

export const withoutCondition = (filter: PrintFilter, condition: FilterCondition): PrintFilter =>
  condition.kind === 'topic'
    ? { ...filter, topicIds: filter.topicIds.filter((id) => id !== condition.topicId) }
    : { ...filter, [condition.kind]: undefined }
