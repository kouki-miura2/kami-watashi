<script setup lang="ts">
import { LIMITS } from 'utils'
import { computed } from 'vue'

import NameDialog from '../components/NameDialog.vue'
import NameList from '../components/NameList.vue'
import SubPageBar from '../components/SubPageBar.vue'
import { useBack } from '../composables/useBack.ts'
import { useNameEditor } from '../composables/useNameEditor.ts'
import {
  useCreateTopicMutation,
  useDeleteTopicMutation,
  useRenameTopicMutation,
  useTopicsQuery,
} from '../composables/useTopics.ts'
import { useConfirmStore } from '../stores/confirm.ts'

const back = useBack({ name: 'settings' })
const confirm = useConfirmStore()
const topics = useTopicsQuery()
const createTopic = useCreateTopicMutation()
const renameTopic = useRenameTopicMutation()
const deleteTopic = useDeleteTopicMutation()

const items = computed(() =>
  (topics.data.value ?? []).map((topic) => ({ ...topic, note: String(topic.printCount) })),
)
const topicOf = (id: string) => topics.data.value?.find((topic) => topic.id === id)
const full = computed(() => items.value.length >= LIMITS.familyTopics)

const editor = useNameEditor({
  create: (name) => createTopic.mutateAsync(name),
  rename: (input) => renameTopic.mutateAsync(input),
})

const startDelete = async (id: string) => {
  const topic = topicOf(id)
  if (!topic) return
  const confirmed = await confirm.confirm({
    title: `[ ${topic.name} ] を削除しますか？`,
    text:
      topic.printCount > 0
        ? `${topic.printCount}件のプリントから外れます。`
        : 'このトピックが付いたプリントはありません。',
    confirmText: '削除する',
    danger: true,
  })
  if (confirmed) deleteTopic.mutate(id)
}
</script>

<!-- 5e -->
<template>
  <SubPageBar title="トピック" icon="back" @navigate="back" />
  <div class="px-4 pt-2 pb-16">
    <p v-if="full" class="text-caption text-medium-emphasis px-1 pb-2">
      トピックは最大{{ LIMITS.familyTopics }}個です
    </p>
    <div v-if="topics.isPending.value" class="d-flex justify-center py-8">
      <v-progress-circular indeterminate />
    </div>
    <v-empty-state
      v-else-if="items.length === 0"
      icon="mdi-tag-outline"
      text="トピックを追加すると、プリントを分類して絞り込めます"
    />
    <NameList
      v-else
      :items="items"
      icon="mdi-tag-outline"
      @rename="(id) => editor.startRename(topicOf(id)!)"
      @delete="startDelete"
    />
  </div>

  <v-fab
    app
    location="bottom end"
    extended
    color="primary"
    prepend-icon="mdi-plus"
    text="トピックを追加"
    :disabled="full"
    @click="editor.startAdd"
  />

  <NameDialog
    v-model="editor.open.value"
    :title="editor.target.value?.id ? '名前を変更' : 'トピックを追加'"
    label="トピック名"
    :submit-text="editor.target.value?.id ? '変更する' : '追加する'"
    :initial-name="editor.target.value?.name"
    :loading="createTopic.isPending.value || renameTopic.isPending.value"
    :error="editor.error.value"
    @submit="editor.save"
  />
</template>
