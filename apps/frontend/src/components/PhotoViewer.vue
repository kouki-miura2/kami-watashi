<script setup lang="ts">
import { ref, watch } from 'vue'

import ZoomableImage from './ZoomableImage.vue'

defineProps<{ imageIds: string[] }>()

const page = defineModel<number>('page', { default: 0 })
const zoomed = ref(false)
const images = ref<InstanceType<typeof ZoomableImage>[]>([])

// Turning the page leaves the previous one un-zoomed.
watch(page, () => {
  images.value.forEach((image) => image.reset())
  zoomed.value = false
})
</script>

<!-- A print's pages: swipe to turn (unless zoomed in), pinch to zoom. -->
<template>
  <div class="viewer">
    <v-window v-model="page" :touch="!zoomed" class="viewer__window">
      <v-window-item v-for="(imageId, index) in imageIds" :key="imageId" class="fill-height">
        <ZoomableImage
          ref="images"
          :image-id="imageId"
          :alt="`${index + 1}ページ目`"
          @zoomed="(isZoomed) => (zoomed = isZoomed)"
        />
      </v-window-item>
    </v-window>
    <div v-if="imageIds.length > 1" class="d-flex justify-center align-center ga-2 pb-1">
      <v-btn
        icon="mdi-chevron-left"
        variant="text"
        size="small"
        density="compact"
        aria-label="前のページ"
        :disabled="page === 0"
        @click="page--"
      />
      <span class="text-caption">{{ page + 1 }} / {{ imageIds.length }}</span>
      <v-btn
        icon="mdi-chevron-right"
        variant="text"
        size="small"
        density="compact"
        aria-label="次のページ"
        :disabled="page === imageIds.length - 1"
        @click="page++"
      />
    </div>
  </div>
</template>

<style scoped>
.viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.viewer__window {
  flex: 1;
  min-height: 0;
  /* Just enough to set the photo off the backdrop: the more room, the easier the print is to read. */
  padding: 4px;
}

.viewer__window :deep(.v-window__container) {
  height: 100%;
}
</style>
