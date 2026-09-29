<script setup lang="ts">
import Panzoom, { type PanzoomEventDetail, type PanzoomObject } from '@panzoom/panzoom'
import { onBeforeUnmount, ref, toRef, watch } from 'vue'

import { useImageQuery } from '../composables/useImageQuery.ts'

const props = defineProps<{ imageId: string; alt: string }>()
const emit = defineEmits<{ zoomed: [isZoomed: boolean] }>()

const image = useImageQuery(toRef(props, 'imageId'))
const target = ref<HTMLElement>()
let panzoom: PanzoomObject | undefined

/**
 * Keeps the photo's edges from coming inside the frame's on each axis where the zoomed photo is
 * larger than the frame, and centered where it isn't. Panzoom's own `contain` can't do this per
 * axis: `outside` would force zooming until the photo covers the whole frame, and `inside` would
 * stop panning a zoomed photo. Panzoom's transform is `scale(s) translate(x, y)` around the
 * photo's center (centered in the frame), so the photo's center sits `x * s` off the frame's.
 */
const containPan = (element: HTMLElement, x: number, y: number, scale: number) => {
  const frame = element.parentElement!
  const clamp = (offset: number, size: number, frameSize: number) => {
    const limit = Math.max(0, (size * scale - frameSize) / 2) / scale
    return Math.min(Math.max(offset, -limit), limit)
  }
  return {
    x: clamp(x, element.offsetWidth, frame.clientWidth),
    y: clamp(y, element.offsetHeight, frame.clientHeight),
  }
}

/**
 * Brings Panzoom's own position into bounds once a gesture ends: it keeps counting past the edge
 * while dragging (only the drawing is clamped), and the next gesture would start from there.
 */
const syncPan = () => {
  if (!panzoom || !target.value) return
  const { x, y } = panzoom.getPan()
  const next = containPan(target.value, x, y, panzoom.getScale())
  // `force`: also at the start scale, where `panOnlyWhenZoomed` would ignore the pan.
  if (next.x !== x || next.y !== y) panzoom.pan(next.x, next.y, { force: true, animate: false })
}

const onChange = (event: Event) =>
  emit('zoomed', (event as CustomEvent<PanzoomEventDetail>).detail.scale > 1.01)

const onWheel = (event: WheelEvent) => {
  panzoom?.zoomWithWheel(event)
  syncPan()
}

// Pinch (and wheel) zoom; panning only once zoomed in, so a plain swipe still turns the page.
watch(target, (element, previous) => {
  previous?.removeEventListener('panzoomchange', onChange)
  previous?.removeEventListener('panzoomend', syncPan)
  previous?.parentElement?.removeEventListener('wheel', onWheel)
  panzoom?.destroy()
  panzoom = undefined
  if (!element) return
  panzoom = Panzoom(element, {
    minScale: 1,
    maxScale: 5,
    panOnlyWhenZoomed: true,
    // Every frame is drawn already in bounds, so a drag stops at the photo's edge instead of
    // overshooting and snapping back (Panzoom draws first and reports the change afterwards).
    setTransform: (elem, { x, y, scale }) => {
      const pan = containPan(elem as HTMLElement, x, y, scale)
      elem.style.transform = `scale(${scale}) translate(${pan.x}px, ${pan.y}px)`
    },
  })
  element.addEventListener('panzoomchange', onChange)
  element.addEventListener('panzoomend', syncPan)
  element.parentElement?.addEventListener('wheel', onWheel)
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
