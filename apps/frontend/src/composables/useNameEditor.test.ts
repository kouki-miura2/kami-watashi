import { expect, test, vi } from 'vite-plus/test'

import { ApiError } from '../api/errors.ts'
import { useNameEditor } from './useNameEditor.ts'

const setup = () => {
  const actions = { create: vi.fn(async () => {}), rename: vi.fn(async () => {}) }
  return { actions, editor: useNameEditor(actions) }
}

test('adding creates the name and closes the dialog', async () => {
  const { actions, editor } = setup()

  editor.startAdd()
  expect(editor.open.value).toBe(true)
  await editor.save('はなこ')

  expect(actions.create).toHaveBeenCalledWith('はなこ')
  expect(editor.open.value).toBe(false)
})

test('renaming starts from the current name and renames that item', async () => {
  const { actions, editor } = setup()

  editor.startRename({ id: 'c1', name: 'はなこ' })
  expect(editor.target.value).toEqual({ id: 'c1', name: 'はなこ' })
  await editor.save('かなこ')

  expect(actions.rename).toHaveBeenCalledWith({ id: 'c1', name: 'かなこ' })
  expect(actions.create).not.toHaveBeenCalled()
})

test('a failure keeps the dialog open with its message, cleared on the next open', async () => {
  const { actions, editor } = setup()
  actions.create.mockRejectedValueOnce(new ApiError('name_taken', 409))

  editor.startAdd()
  await editor.save('はなこ')

  expect(editor.open.value).toBe(true)
  expect(editor.error.value).toBe('同じ名前がすでにあります')

  editor.open.value = false
  editor.startAdd()
  expect(editor.error.value).toBeUndefined()
})
