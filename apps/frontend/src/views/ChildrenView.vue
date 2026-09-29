<script setup lang="ts">
import { LIMITS } from 'utils'
import { computed, ref } from 'vue'

import NameDialog from '../components/NameDialog.vue'
import NameList from '../components/NameList.vue'
import SubPageBar from '../components/SubPageBar.vue'
import TypeToConfirmDialog from '../components/TypeToConfirmDialog.vue'
import { useBack } from '../composables/useBack.ts'
import {
  useChildrenQuery,
  useCreateChildMutation,
  useDeleteChildMutation,
  useFetchSlotPrintCount,
  useRenameChildMutation,
} from '../composables/useChildren.ts'
import { useNameEditor } from '../composables/useNameEditor.ts'
import { useConfirmStore } from '../stores/confirm.ts'

const back = useBack({ name: 'settings' })
const confirm = useConfirmStore()
const children = useChildrenQuery()
const createChild = useCreateChildMutation()
const renameChild = useRenameChildMutation()
const deleteChild = useDeleteChildMutation()
const fetchPrintCount = useFetchSlotPrintCount()

/** Children only: the family-common slot is always there and can't be renamed or deleted. */
const items = computed(() =>
  (children.data.value ?? []).flatMap((slot) =>
    slot.id === null ? [] : [{ id: slot.id, name: slot.name }],
  ),
)
const itemOf = (id: string) => items.value.find((item) => item.id === id)
const full = computed(() => items.value.length >= LIMITS.familyChildren)

const editor = useNameEditor({
  create: (name) => createChild.mutateAsync(name),
  rename: (input) => renameChild.mutateAsync(input),
})

/** The child whose deletion passed the first confirmation, awaiting their name (5c). */
const deleting = ref<{ id: string; name: string; printCount: number } | null>(null)
const deleteDialogOpen = computed({
  get: () => deleting.value !== null,
  set: (isOpen) => {
    if (!isOpen) deleting.value = null
  },
})

// Deleting a child takes all their prints, so it is confirmed twice (spec): a dialog with the
// print count, then typing the child's name.
const startDelete = async (id: string) => {
  const child = itemOf(id)
  if (!child) return
  let printCount: number
  try {
    printCount = await fetchPrintCount(id)
  } catch {
    return // Reported app-wide.
  }
  const confirmed = await confirm.confirm({
    title: `「${child.name}」を削除しますか？`,
    text: `${child.name}のプリント ${printCount} 件と写真もすべて削除されます。元に戻せません。`,
    confirmText: 'つぎへ',
    danger: true,
  })
  if (confirmed) deleting.value = { ...child, printCount }
}

const finishDelete = () => {
  if (!deleting.value) return
  deleteChild.mutate(deleting.value.id, { onSuccess: () => (deleting.value = null) })
}
</script>

<template>
  <SubPageBar title="こども" icon="back" @navigate="back" />
  <div class="px-4 pt-2 pb-16">
    <p v-if="full" class="text-caption text-medium-emphasis px-1 pb-2">
      こどもは最大{{ LIMITS.familyChildren }}人です
    </p>
    <div v-if="children.isPending.value" class="d-flex justify-center py-8">
      <v-progress-circular indeterminate />
    </div>
    <v-empty-state
      v-else-if="items.length === 0"
      icon="mdi-baby-face-outline"
      text="こどもを追加すると、こどもごとにプリントを整理できます"
    />
    <NameList
      v-else
      :items="items"
      icon="mdi-baby-face-outline"
      @rename="(id) => editor.startRename(itemOf(id)!)"
      @delete="startDelete"
    />
  </div>

  <v-fab
    app
    location="bottom end"
    extended
    color="primary"
    prepend-icon="mdi-plus"
    text="こどもを追加"
    :disabled="full"
    @click="editor.startAdd"
  />

  <NameDialog
    v-model="editor.open.value"
    :title="editor.target.value?.id ? '名前を変更' : 'こどもを追加'"
    label="こどもの名前"
    :submit-text="editor.target.value?.id ? '変更する' : '追加する'"
    :initial-name="editor.target.value?.name"
    :loading="createChild.isPending.value || renameChild.isPending.value"
    :error="editor.error.value"
    @submit="editor.save"
  />
  <TypeToConfirmDialog
    v-if="deleting"
    v-model="deleteDialogOpen"
    :title="`本当に「${deleting.name}」を削除しますか？`"
    :text="`${deleting.name}のプリント ${deleting.printCount} 件と写真もすべて削除されます。確認のため、こどもの名前を入力してください。`"
    label="こどもの名前"
    :expected="deleting.name"
    confirm-text="削除する"
    :loading="deleteChild.isPending.value"
    @confirm="finishDelete"
  />
</template>
