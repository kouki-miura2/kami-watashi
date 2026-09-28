import { expect, test } from 'vite-plus/test'

import { formatHistory, type HistoryItem, historySentence } from './history.ts'

const item = (fields: Partial<HistoryItem>): HistoryItem => ({
  memberName: '一郎',
  target: 'print',
  action: 'create',
  name: null,
  newName: null,
  printSeq: null,
  details: null,
  ...fields,
})
const sentence = (fields: Partial<HistoryItem>) => historySentence(formatHistory(item(fields)))

// Every example of the spec's "履歴 > 表示例" table (the timestamp is shown separately).
test.each([
  [{ target: 'child', action: 'create', name: 'はなこ' }, '一郎がはなこを登録'],
  [
    { memberName: '二郎', target: 'child', action: 'update', name: 'はなこ', newName: 'かなこ' },
    '二郎がはなこをかなこに変更',
  ],
  [
    { target: 'child', action: 'delete', name: 'かなこ', details: { print_count: 12 } },
    '一郎がかなこを削除（プリント12件も削除）',
  ],
  [{ target: 'topic', action: 'create', name: 'サッカー' }, '一郎が [ サッカー ] トピックを登録'],
  [
    { target: 'topic', action: 'update', name: 'サッカー', newName: 'サッカークラブ' },
    '一郎が [ サッカー ] トピックを [ サッカークラブ ] トピックに変更',
  ],
  [
    { target: 'topic', action: 'delete', name: 'サッカークラブ' },
    '一郎が [ サッカークラブ ] トピックを削除（すべてのプリントから削除）',
  ],
  [{ name: 'はなこ', printSeq: 1 }, '一郎がはなこのプリント（00001）を登録'],
  [
    {
      name: 'はなこ',
      printSeq: 1,
      details: {
        topics: ['サッカークラブ', '試合'],
        received_on: '2026-09-25',
        due_on: '2026-10-03',
      },
    },
    '一郎がはなこのプリント（00001）を登録（[ サッカークラブ, 試合 ]、2026.09.25受取、2026.10.03まで）',
  ],
  [
    {
      action: 'update',
      name: 'はなこ',
      printSeq: 1,
      details: { topics: ['試合'], due_on: '2026-10-02' },
    },
    '一郎がはなこのプリント（00001）を変更（[ 試合 ]、2026.10.02まで）',
  ],
  [
    {
      action: 'update',
      name: 'はなこ',
      printSeq: 1,
      details: { title: '運動会のお知らせ', response_status: 'done', image_count: 3 },
    },
    '一郎がはなこのプリント（00001）を変更（「運動会のお知らせ」、対応=対応済、写真=3枚）',
  ],
  [{ action: 'delete', name: 'はなこ', printSeq: 1 }, '一郎がはなこのプリント（00001）を削除'],
  [{ action: 'delete', name: 'はなこ', printSeq: 2 }, '一郎がはなこのプリント（00002）を削除'],
  [
    { name: 'たろう', printSeq: 5, details: { title: '遠足のお知らせ' } },
    '一郎がたろうのプリント（00005）を登録（「遠足のお知らせ」）',
  ],
  [
    { action: 'bulk_delete', details: { older_than_months: 12, print_count: 20 } },
    '一郎が1年以上前に登録したプリントを一括削除（20件）',
  ],
  [
    { target: 'member', action: 'update', name: '一郎', newName: '一朗' },
    '一郎が表示名を一朗に変更',
  ],
] as [Partial<HistoryItem>, string][])('%o reads 「%s」', (fields, expected) => {
  expect(sentence(fields)).toBe(expected)
})

test('a child deleted without prints says nothing about prints', () => {
  expect(
    sentence({ target: 'child', action: 'delete', name: 'かなこ', details: { print_count: 0 } }),
  ).toBe('一郎がかなこを削除')
})

test('the family-common slot reads as 家族共通のプリント', () => {
  expect(sentence({ name: '家族共通', printSeq: 1 })).toBe(
    '一郎が家族共通のプリント（00001）を登録',
  )
})

test('cleared print items still say what changed', () => {
  expect(
    sentence({
      action: 'update',
      name: 'はなこ',
      printSeq: 1,
      details: {
        title: null,
        topics: [],
        received_on: null,
        due_on: null,
        response_status: 'none',
      },
    }),
  ).toBe('一郎がはなこのプリント（00001）を変更（「」、[  ]、受取日なし、期限なし、対応=不要）')
})

test('the print items go on their own line for the timeline, with the dot kind', () => {
  expect(
    formatHistory(
      item({ action: 'update', name: 'はなこ', printSeq: 12, details: { image_count: 3 } }),
    ),
  ).toEqual({
    who: '一郎',
    text: 'はなこのプリント（00012）を変更',
    detail: '写真=3枚',
    kind: 'update',
  })
  expect(
    formatHistory(
      item({ action: 'bulk_delete', details: { older_than_months: 3, print_count: 2 } }),
    ).kind,
  ).toBe('delete')
})
