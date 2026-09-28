<script setup lang="ts">
import { toRef } from 'vue'

import { useImageQuery } from '../composables/useImageQuery.ts'

const props = defineProps<{
  imageId: string | null
  /** Shown in the corner when the print has several pages. */
  pages?: number
  width?: number
  height?: number
}>()

const image = useImageQuery(toRef(props, 'imageId'))
</script>

<!-- A print's first page, small (lists). -->
<template>
  <div class="thumb" :style="{ width: `${width ?? 56}px`, height: `${height ?? 72}px` }">
    <v-img v-if="image.data.value" :src="image.data.value" cover class="fill-height" />
    <span v-if="pages && pages > 1" class="thumb__pages">{{ pages }}</span>
  </div>
</template>

<style scoped>
.thumb {
  position: relative;
  flex: none;
  overflow: hidden;
  border-radius: 6px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  background: rgb(var(--v-theme-surface-light));
}

.thumb__pages {
  position: absolute;
  right: 3px;
  bottom: 3px;
  padding: 0 4px;
  border-radius: 3px;
  font-size: 9px;
  font-weight: 700;
  color: rgb(var(--v-theme-on-primary));
  background: rgb(var(--v-theme-primary));
}
</style>
