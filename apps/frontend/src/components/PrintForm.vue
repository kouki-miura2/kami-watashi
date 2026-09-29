<script setup lang="ts">
import { charLength, LIMITS } from 'utils'
import { computed, ref } from 'vue'

import { errorMessage } from '../api/errors.ts'
import { useChildrenQuery } from '../composables/useChildren.ts'
import type { PrintFormValues } from '../composables/usePrints.ts'
import { useCreateTopicMutation, useTopicsQuery } from '../composables/useTopics.ts'
import { toSlotCards } from '../lib/slots.ts'
import { titleRules } from '../lib/validation.ts'
import NameDialog from './NameDialog.vue'

const form = defineModel<PrintFormValues>({ required: true })

const children = useChildrenQuery()
const topics = useTopicsQuery()
const createTopic = useCreateTopicMutation()
const slots = computed(() => toSlotCards(children.data.value ?? []))
const topicsFull = computed(() => (topics.data.value?.length ?? 0) >= LIMITS.familyTopics)

// A topic created here is selected right away.
const topicDialogOpen = ref(false)
const topicError = ref<string>()
const openTopicDialog = () => {
  topicError.value = undefined
  topicDialogOpen.value = true
}
const addTopic = (name: string) =>
  createTopic.mutate(name, {
    onSuccess: (topic) => {
      if (form.value.topicIds.length < LIMITS.printTopics) form.value.topicIds.push(topic.id)
      topicDialogOpen.value = false
    },
    onError: (error) => (topicError.value = errorMessage(error)),
  })
</script>

<!-- The fields of a print (4a), shared by registering and changing one. The photos go in the `photos` slot. -->
<template>
  <section>
    <div class="field-label">だれの？<span class="text-link">*</span></div>
    <v-chip-group v-model="form.slot" selected-class="bg-secondary" column>
      <v-chip
        v-for="card in slots"
        :key="card.param"
        :value="card.param"
        :text="card.slot.name"
        variant="outlined"
      />
    </v-chip-group>
  </section>

  <slot name="photos" />

  <v-text-field
    v-model="form.title"
    label="タイトル"
    :rules="titleRules"
    :counter="LIMITS.titleMaxLength"
    :counter-value="(value: string) => charLength(value.trim())"
  />
  <div class="d-flex ga-3">
    <v-text-field v-model="form.receivedOn" type="date" label="受け取った日" clearable />
    <v-text-field v-model="form.dueOn" type="date" label="期限・行事の日" clearable />
  </div>

  <section>
    <div class="field-label d-flex justify-space-between">
      <span>トピック</span>
      <span>{{ form.topicIds.length }}/{{ LIMITS.printTopics }}</span>
    </div>
    <v-chip-group
      v-model="form.topicIds"
      multiple
      :max="LIMITS.printTopics"
      selected-class="bg-primary"
      column
    >
      <v-chip
        v-for="topic in topics.data.value"
        :key="topic.id"
        :value="topic.id"
        :text="topic.name"
        variant="outlined"
      />
    </v-chip-group>
    <v-chip
      prepend-icon="mdi-plus"
      text="新規"
      variant="outlined"
      class="border-dashed"
      :disabled="topicsFull"
      @click="openTopicDialog"
    />
  </section>

  <section>
    <div class="field-label">対応状態</div>
    <v-btn-toggle
      v-model="form.responseStatus"
      mandatory
      color="primary"
      divided
      variant="outlined"
      density="comfortable"
      class="w-100"
    >
      <v-btn value="none" text="不要" class="flex-1-1" />
      <v-btn value="todo" text="未対応" class="flex-1-1" />
      <v-btn value="done" text="対応済" class="flex-1-1" />
    </v-btn-toggle>
  </section>

  <NameDialog
    v-model="topicDialogOpen"
    title="トピックを追加"
    label="トピック名"
    submit-text="追加する"
    :loading="createTopic.isPending.value"
    :error="topicError"
    @submit="addTopic"
  />
</template>
