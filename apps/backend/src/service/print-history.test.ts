import { expect, test } from 'vite-plus/test'

import { type PrintHistoryFields, createdDetails, updatedDetails } from './print-history.ts'

const empty: PrintHistoryFields = {
  title: null,
  topics: [],
  receivedOn: null,
  dueOn: null,
  responseStatus: 'none',
}

test('createdDetails records only the items that are set', () => {
  expect(createdDetails(empty)).toBeNull()
  expect(
    createdDetails({
      ...empty,
      topics: ['サッカークラブ', '試合'],
      receivedOn: '2026-09-25',
      dueOn: '2026-10-03',
    }),
  ).toEqual({
    topics: ['サッカークラブ', '試合'],
    received_on: '2026-09-25',
    due_on: '2026-10-03',
  })
})

test('createdDetails records the response status only when todo or done', () => {
  expect(createdDetails({ ...empty, responseStatus: 'none' })).toBeNull()
  expect(createdDetails({ ...empty, responseStatus: 'todo' })).toEqual({ response_status: 'todo' })
})

test('updatedDetails records the new value of each changed item', () => {
  const before = { ...empty, title: '遠足', topics: ['試合'], dueOn: '2026-10-03' }

  expect(updatedDetails(before, before)).toBeNull()
  expect(
    updatedDetails(before, { ...before, dueOn: '2026-10-02', responseStatus: 'done' }),
  ).toEqual({ due_on: '2026-10-02', response_status: 'done' })
})

test('updatedDetails records a cleared item as null or an empty list', () => {
  const before = { ...empty, title: '遠足', topics: ['試合'] }

  expect(updatedDetails(before, { ...before, title: null, topics: [] })).toEqual({
    title: null,
    topics: [],
  })
})

test('updatedDetails ignores a reordering of the same topics', () => {
  const before = { ...empty, topics: ['試合', 'サッカークラブ'] }

  expect(updatedDetails(before, { ...before, topics: ['サッカークラブ', '試合'] })).toBeNull()
})
