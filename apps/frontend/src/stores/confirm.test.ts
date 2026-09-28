import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, expect, test } from 'vite-plus/test'

import { useConfirmStore } from './confirm.ts'

beforeEach(() => {
  setActivePinia(createPinia())
})

const question = { title: 'このプリントを削除しますか？', confirmText: '削除する', danger: true }

test('confirm opens the dialog and resolves true when confirmed', async () => {
  const confirm = useConfirmStore()

  const answer = confirm.confirm(question)
  expect(confirm.options).toEqual(question)

  confirm.answer(true)
  await expect(answer).resolves.toBe(true)
  expect(confirm.options).toBeNull()
})

test('resolves false when cancelled', async () => {
  const confirm = useConfirmStore()

  const answer = confirm.confirm(question)
  confirm.answer(false)

  await expect(answer).resolves.toBe(false)
})

test('a new question cancels the one still open', async () => {
  const confirm = useConfirmStore()

  const first = confirm.confirm(question)
  const second = confirm.confirm({ title: '退会しますか？', confirmText: '退会する' })

  await expect(first).resolves.toBe(false)
  expect(confirm.options?.title).toBe('退会しますか？')
  confirm.answer(true)
  await expect(second).resolves.toBe(true)
})
