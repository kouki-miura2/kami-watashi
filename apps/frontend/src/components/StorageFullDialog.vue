<script setup lang="ts">
import { computed } from 'vue'

import { formatMegabytes } from '../lib/format.ts'

const props = defineProps<{
  usedBytes: number
  limitBytes: number
  /** The size of the photos that did not fit. */
  addedBytes: number
  /** Retaking photos: the original photos are kept. */
  retake?: boolean
}>()
const open = defineModel<boolean>({ required: true })

const percent = (bytes: number) => Math.min(100, (bytes / props.limitBytes) * 100)
const usedPercent = computed(() => percent(props.usedBytes))
const addedPercent = computed(() => Math.min(100 - usedPercent.value, percent(props.addedBytes)))
</script>

<!-- 4d: the family's storage quota would be exceeded, so nothing was saved. -->
<template>
  <v-dialog v-model="open" max-width="400">
    <v-card>
      <v-card-text class="d-flex flex-column ga-3">
        <v-icon icon="mdi-cloud-off-outline" size="30" color="error" />
        <div class="text-h6 font-weight-bold">容量がいっぱいです</div>
        <div>
          <div class="storage-bar">
            <div class="bg-primary" :style="{ width: `${usedPercent}%` }" />
            <div class="bg-error" :style="{ width: `${addedPercent}%` }" />
          </div>
          <div class="d-flex justify-space-between text-caption text-medium-emphasis mt-1">
            <span>{{ formatMegabytes(usedBytes) }} + {{ formatMegabytes(addedBytes) }} MB</span>
            <span>{{ formatMegabytes(limitBytes) }} MB</span>
          </div>
        </div>
        <p class="text-body-2 text-medium-emphasis">
          {{
            retake
              ? '写真は撮り直されませんでした（元の写真は残っています）。'
              : 'このプリントは登録されませんでした。'
          }}古いプリントを削除して容量を空けてください。
        </p>
      </v-card-text>
      <v-card-actions>
        <v-btn text="閉じる" @click="open = false" />
        <v-btn color="link" text="古いプリントを削除" :to="{ name: 'bulk-delete' }" />
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.storage-bar {
  display: flex;
  height: 10px;
  border-radius: 5px;
  overflow: hidden;
  background: rgb(var(--v-theme-surface-light));
}
</style>
