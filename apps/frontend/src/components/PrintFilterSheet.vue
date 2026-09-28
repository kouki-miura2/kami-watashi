<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { usePrintsQuery } from '../composables/usePrints.ts'
import { useTopicsQuery } from '../composables/useTopics.ts'
import type { MiteneStatus, PrintFilter, ReadFilter, ResponseStatus } from '../lib/print-filter.ts'

const props = defineProps<{ slot: string; filter: PrintFilter }>()
const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ apply: [filter: PrintFilter] }>()

const topics = useTopicsQuery()

/** Edited here, applied to the list only with the button. */
const draft = ref<PrintFilter>({ ...props.filter })
watch(open, (isOpen) => {
  if (isOpen) draft.value = { ...props.filter, topicIds: [...props.filter.topicIds] }
})

// How many prints the draft would show, so the button can say so (and avoid a 0-result surprise).
const preview = usePrintsQuery(
  () => props.slot,
  () => draft.value,
)
const previewCount = computed(() => (open.value ? preview.data.value?.length : undefined))

type SegmentKey = 'read' | 'response' | 'mitene'

/** The segmented controls; the `all` option stands for "no filter". */
const segments: {
  key: SegmentKey
  label: string
  options: { value: ReadFilter | ResponseStatus | MiteneStatus | 'all'; text: string }[]
}[] = [
  {
    key: 'read',
    label: '既読状態',
    options: [
      { value: 'all', text: 'すべて' },
      { value: 'unread', text: '未読' },
      { value: 'read', text: '既読' },
    ],
  },
  {
    key: 'response',
    label: '対応状態',
    options: [
      { value: 'all', text: 'すべて' },
      { value: 'none', text: '不要' },
      { value: 'todo', text: '未対応' },
      { value: 'done', text: '対応済' },
    ],
  },
  {
    key: 'mitene',
    label: '見てね状態',
    options: [
      { value: 'all', text: 'すべて' },
      { value: 'none', text: 'なし' },
      { value: 'requested', text: '見てね' },
      { value: 'seen', text: '見たよ' },
    ],
  },
]

const setSegment = (key: SegmentKey, value: string) => {
  draft.value = { ...draft.value, [key]: value === 'all' ? undefined : value }
}

const reset = () => {
  draft.value = { sort: draft.value.sort, topicIds: [] }
}

const apply = () => {
  emit('apply', draft.value)
  open.value = false
}
</script>

<!-- 2d -->
<template>
  <v-bottom-sheet v-model="open">
    <v-card class="pb-4">
      <v-card-item>
        <v-card-title class="font-weight-bold">絞り込み</v-card-title>
        <template #append>
          <v-btn variant="text" color="link" text="リセット" @click="reset" />
        </template>
      </v-card-item>
      <v-card-text class="d-flex flex-column ga-4">
        <section>
          <div class="field-label">
            トピック <span class="font-weight-regular">— 選んだものをすべて含む</span>
          </div>
          <v-chip-group v-model="draft.topicIds" multiple column selected-class="bg-primary">
            <v-chip
              v-for="topic in topics.data.value"
              :key="topic.id"
              :value="topic.id"
              :text="topic.name"
              variant="outlined"
            />
          </v-chip-group>
        </section>
        <section v-for="control in segments" :key="control.key">
          <div class="field-label">{{ control.label }}</div>
          <v-btn-toggle
            :model-value="draft[control.key] ?? 'all'"
            mandatory
            divided
            variant="outlined"
            color="primary"
            density="comfortable"
            class="w-100"
            @update:model-value="(value: string) => setSegment(control.key, value)"
          >
            <v-btn
              v-for="option in control.options"
              :key="option.value"
              :value="option.value"
              :text="option.text"
              class="flex-1-1"
            />
          </v-btn-toggle>
        </section>
        <v-btn
          color="primary"
          size="large"
          block
          :text="previewCount === undefined ? '表示する' : `${previewCount}件を表示`"
          :loading="preview.isFetching.value"
          @click="apply"
        />
      </v-card-text>
    </v-card>
  </v-bottom-sheet>
</template>
