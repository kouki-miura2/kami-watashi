<script setup lang="ts">
import type { ResponseStatus } from '../lib/print-filter.ts'

defineProps<{ status: ResponseStatus }>()
const open = defineModel<boolean>({ required: true })
defineEmits<{ select: [status: ResponseStatus] }>()

const options: { value: ResponseStatus; title: string; subtitle: string; icon: string }[] = [
  {
    value: 'none',
    title: '不要',
    subtitle: '読むだけでOKなお知らせ',
    icon: 'mdi-minus-circle-outline',
  },
  {
    value: 'todo',
    title: '未対応',
    subtitle: '提出・持ち物・申込みなどがある',
    icon: 'mdi-clipboard-clock-outline',
  },
  {
    value: 'done',
    title: '対応済',
    subtitle: 'やることは終わった',
    icon: 'mdi-check-circle-outline',
  },
]
</script>

<!-- 3c: shared by the whole family; picking one saves it right away. -->
<template>
  <v-bottom-sheet v-model="open">
    <v-card class="pb-4">
      <v-card-item>
        <v-card-title class="font-weight-bold">対応状態</v-card-title>
        <v-card-subtitle>家族全員で共有されます</v-card-subtitle>
      </v-card-item>
      <v-card-text class="d-flex flex-column ga-2">
        <v-card
          v-for="option in options"
          :key="option.value"
          :color="status === option.value && option.value !== 'none' ? option.value : undefined"
          :class="{ 'border-opacity-100': status === option.value }"
          @click="$emit('select', option.value)"
        >
          <v-list-item
            :title="option.title"
            :subtitle="option.subtitle"
            :prepend-icon="option.icon"
          >
            <template #append>
              <v-icon
                :icon="status === option.value ? 'mdi-radiobox-marked' : 'mdi-radiobox-blank'"
              />
            </template>
          </v-list-item>
        </v-card>
      </v-card-text>
    </v-card>
  </v-bottom-sheet>
</template>
