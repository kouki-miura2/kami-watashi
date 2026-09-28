import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface ConfirmOptions {
  title: string
  text?: string
  /** Label of the confirming button, e.g. 「削除する」. */
  confirmText: string
  /** Shows the confirming button in the error color (deletions). */
  danger?: boolean
}

/**
 * The app-wide confirmation dialog (rendered once by `ConfirmDialog.vue` in `App.vue`).
 * `await confirm({...})` resolves `true` when confirmed, `false` when cancelled or dismissed.
 */
export const useConfirmStore = defineStore('confirm', () => {
  const options = ref<ConfirmOptions | null>(null)
  let resolveAnswer: ((confirmed: boolean) => void) | null = null

  const answer = (confirmed: boolean) => {
    resolveAnswer?.(confirmed)
    resolveAnswer = null
    options.value = null
  }

  const confirm = (next: ConfirmOptions): Promise<boolean> => {
    // A new question replaces one still open, which counts as cancelled.
    answer(false)
    options.value = next
    return new Promise((resolve) => {
      resolveAnswer = resolve
    })
  }

  return { options, confirm, answer }
})
