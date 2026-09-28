import { expect, test, vi } from 'vite-plus/test'

import type { HistoryDao } from '../dao/history.interface.ts'
import { createHistoryRepository, toHistoryRecord } from './history.repository.ts'

test('maps an entry to a row, defaulting absent fields to NULL', () => {
  expect(
    toHistoryRecord(
      'f1',
      { memberName: '一郎', target: 'member', action: 'update', name: '一郎', newName: '一朗' },
      123,
    ),
  ).toEqual({
    id: expect.any(String),
    family_id: 'f1',
    member_name: '一郎',
    target: 'member',
    action: 'update',
    name: '一郎',
    new_name: '一朗',
    print_seq: null,
    details: null,
    created_at: 123,
  })
})

test('serializes details as JSON', () => {
  const record = toHistoryRecord(
    'f1',
    {
      memberName: '一郎',
      target: 'print',
      action: 'update',
      printSeq: 1,
      details: { topics: ['試合'] },
    },
    0,
  )

  expect(record.details).toBe('{"topics":["試合"]}')
  expect(record.print_seq).toBe(1)
})

test('listPage maps rows, parsing details and keeping each row’s position', async () => {
  const listPage = vi.fn<HistoryDao['listPage']>(async () => [
    {
      rowid: 42,
      id: 'h1',
      family_id: 'f1',
      member_name: '一郎',
      target: 'child',
      action: 'delete',
      name: 'かなこ',
      new_name: null,
      print_seq: null,
      details: '{"print_count":12}',
      created_at: 1000,
    },
  ])
  const after = { createdAt: 2000, rowid: 50 }

  expect(await createHistoryRepository({ listPage }).listPage('f1', after, 10)).toEqual([
    {
      id: 'h1',
      memberName: '一郎',
      target: 'child',
      action: 'delete',
      name: 'かなこ',
      newName: null,
      printSeq: null,
      details: { print_count: 12 },
      createdAt: 1000,
      position: { createdAt: 1000, rowid: 42 },
    },
  ])
  expect(listPage).toHaveBeenCalledWith('f1', after, 10)
})
