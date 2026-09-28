<script setup lang="ts">
import { formatJstDateTime } from 'utils'

import { formatDateString } from '../lib/print-format.ts'

defineProps<{
  receivedOn: string | null
  dueOn: string | null
  topicNames: string[]
  createdAt: number
}>()
const open = defineModel<boolean>({ required: true })
</script>

<!-- 3d: read-only; editing goes through ⋯ → 変更. -->
<template>
  <v-bottom-sheet v-model="open">
    <v-card title="プリントの情報" class="pb-4">
      <v-card-text>
        <v-card>
          <v-list density="comfortable">
            <v-list-item title="受け取った日">
              <template #append>{{ receivedOn ? formatDateString(receivedOn) : '—' }}</template>
            </v-list-item>
            <v-divider />
            <v-list-item title="期限・行事の日">
              <template #append>
                <span :class="{ 'text-link font-weight-bold': dueOn }">
                  {{ dueOn ? formatDateString(dueOn) : '—' }}
                </span>
              </template>
            </v-list-item>
            <v-divider />
            <v-list-item title="トピック">
              <template #append>
                <div v-if="topicNames.length > 0" class="d-flex flex-wrap justify-end ga-1">
                  <v-chip v-for="name in topicNames" :key="name" :text="name" size="small" />
                </div>
                <span v-else>—</span>
              </template>
            </v-list-item>
            <v-divider />
            <v-list-item title="登録">
              <template #append>{{ formatJstDateTime(new Date(createdAt)) }}</template>
            </v-list-item>
          </v-list>
        </v-card>
      </v-card-text>
    </v-card>
  </v-bottom-sheet>
</template>
