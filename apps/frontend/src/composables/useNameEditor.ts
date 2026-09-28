import { computed, ref } from 'vue'

import { errorMessage } from '../api/errors.ts'

/**
 * State of the add/rename name dialog of a management screen (children, topics). `save` runs the
 * matching mutation, closes the dialog on success, and keeps it open with the error otherwise.
 */
export const useNameEditor = (actions: {
  create: (name: string) => Promise<unknown>
  rename: (input: { id: string; name: string }) => Promise<unknown>
}) => {
  /** What is being edited: `id: null` when adding. `null` while the dialog is closed. */
  const target = ref<{ id: string | null; name: string } | null>(null)
  const error = ref<string>()

  const open = computed({
    get: () => target.value !== null,
    set: (isOpen) => {
      if (!isOpen) target.value = null
    },
  })

  const startAdd = () => {
    target.value = { id: null, name: '' }
    error.value = undefined
  }

  const startRename = (item: { id: string; name: string }) => {
    target.value = { id: item.id, name: item.name }
    error.value = undefined
  }

  const save = async (name: string) => {
    const editing = target.value
    if (!editing) return
    error.value = undefined
    try {
      if (editing.id === null) await actions.create(name)
      else await actions.rename({ id: editing.id, name })
      target.value = null
    } catch (failure) {
      error.value = errorMessage(failure)
    }
  }

  return { target, open, error, startAdd, startRename, save }
}
