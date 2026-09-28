<script setup lang="ts">
import Panzoom, { type PanzoomEventDetail, type PanzoomObject } from '@panzoom/panzoom'
import { onBeforeUnmount, ref, toRef, watch } from 'vue'

import { useImageQuery } from '../composables/useImageQuery.ts'

const props = defineProps<{ imageId: string; alt: string }>()
const emit = defineEmits<{ zoomed: [isZoomed: boolean] }>()

const image = useImageQuery(toRef(props, 'imageId'))
const target = ref<HTMLElement>()
let panzoom: PanzoomObject | undefined

const onChange = (event: Event) =>
  emit('zoomed', (event as CustomEvent<PanzoomEventDetail>).detail.scale > 1.01)

// Pinch (and wheel) zoom; panning only once zoomed in, so a plain swipe still turns the page.
watch(target, (element, previous) => {
  previous?.removeEventListener('panzoomchange', onChange)
  panzoom?.destroy()
  panzoom = undefined
  if (!element) return
  panzoom = Panzoom(element, { minScale: 1, maxScale: 5, panOnlyWhenZoomed: true })
  element.addEventListener('panzoomchange', onChange)
  element.parentElement?.addEventListener('wheel', panzoom.zoomWithWheel)
})
onBeforeUnmount(() => panzoom?.destroy())

defineExpose({ reset: () => panzoom?.reset({ animate: false }) })
</script>

<template>
  <div class="zoom-frame">
    <v-progress-circular v-if="!image.data.value" indeterminate color="white" />
    <img v-else ref="target" :src="image.data.value" :alt class="zoom-image" />
  </div>
</template>

<style scoped>
.zoom-frame {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.zoom-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
  touch-action: none;
}
</style>
