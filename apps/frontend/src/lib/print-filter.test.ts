import { expect, test } from 'vite-plus/test'

import {
  activeConditions,
  EMPTY_FILTER,
  filterFromQuery,
  filterToQuery,
  toApiQuery,
  withoutCondition,
} from './print-filter.ts'

test('filterFromQuery reads the route query, ignoring unknown values', () => {
  expect(filterFromQuery({})).toEqual(EMPTY_FILTER)
  expect(
    filterFromQuery({
      sort: 'due',
      topics: 't1,t2',
      read: 'unread',
      response: 'todo',
      mitene: 'requested',
    }),
  ).toEqual({
    sort: 'due',
    topicIds: ['t1', 't2'],
    read: 'unread',
    response: 'todo',
    mitene: 'requested',
  })
  expect(filterFromQuery({ sort: 'oldest', mitene: 'maybe' })).toEqual(EMPTY_FILTER)
})

test('filterToQuery round-trips and leaves defaults out', () => {
  const filter = { sort: 'due' as const, topicIds: ['t1'], response: 'done' as const }

  expect(filterToQuery(EMPTY_FILTER)).toEqual({})
  expect(filterFromQuery(filterToQuery(filter))).toEqual({ ...filter })
})

test('toApiQuery sends only the set filters', () => {
  expect(toApiQuery('common', EMPTY_FILTER)).toEqual({ child: 'common', sort: 'created' })
  expect(
    toApiQuery('c1', { sort: 'created', topicIds: ['t1', 't2'], mitene: 'requested' }),
  ).toEqual({
    child: 'c1',
    sort: 'created',
    topicIds: 't1,t2',
    mitene: 'requested',
  })
})

test('activeConditions labels each condition, skipping deleted topics', () => {
  const names: Record<string, string> = { t1: 'サッカー' }
  const conditions = activeConditions(
    { sort: 'created', topicIds: ['t1', 'gone'], read: 'unread', mitene: 'requested' },
    (id) => names[id],
  )

  expect(conditions.map((condition) => condition.label)).toEqual(['見てね', '未読', 'サッカー'])
})

test('withoutCondition removes just that condition', () => {
  const filter = { sort: 'due' as const, topicIds: ['t1', 't2'], read: 'read' as const }

  expect(withoutCondition(filter, { kind: 'topic', topicId: 't1' })).toEqual({
    ...filter,
    topicIds: ['t2'],
  })
  expect(withoutCondition(filter, { kind: 'read' }).read).toBeUndefined()
})
