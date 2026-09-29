<script setup lang="ts">
import jsQR from 'jsqr'
import { onBeforeUnmount, onMounted, ref } from 'vue'

const emit = defineEmits<{
  /** A QR code's text, every time one is in view (the parent decides whether it's the right one). */
  detect: [text: string]
  /** The camera couldn't be opened (permission refused, no camera, not https). */
  error: []
}>()

/** Decoding every frame isn't needed to feel instant, and would heat the phone up. */
const SCAN_INTERVAL_MS = 150
/** Frames are scaled down to this long edge before decoding: plenty for a QR code on a screen. */
const MAX_EDGE_PX = 640

const video = ref<HTMLVideoElement>()
let stream: MediaStream | undefined
let timer: ReturnType<typeof setTimeout> | undefined
let stopped = false
const canvas = document.createElement('canvas')
const context = canvas.getContext('2d', { willReadFrequently: true })!

const scan = () => {
  const frame = video.value
  if (frame && frame.readyState >= frame.HAVE_CURRENT_DATA && frame.videoWidth > 0) {
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(frame.videoWidth, frame.videoHeight))
    canvas.width = Math.round(frame.videoWidth * scale)
    canvas.height = Math.round(frame.videoHeight * scale)
    context.drawImage(frame, 0, 0, canvas.width, canvas.height)
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
    const code = jsQR(data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' })
    if (code?.data) emit('detect', code.data)
  }
  if (!stopped) timer = setTimeout(scan, SCAN_INTERVAL_MS)
}

const stop = () => {
  stopped = true
  clearTimeout(timer)
  stream?.getTracks().forEach((track) => track.stop())
}

// The back camera, through the browser (https or localhost only).
onMounted(async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false,
    })
  } catch {
    if (!stopped) emit('error')
    return
  }
  // Left the screen while the permission prompt was up.
  if (stopped || !video.value) return stop()
  video.value.srcObject = stream
  await video.value.play().catch(() => undefined)
  scan()
})
onBeforeUnmount(stop)
</script>

<!-- The camera's view, with a frame to aim the QR code into. -->
<template>
  <div class="scanner">
    <video ref="video" class="scanner__video" muted playsinline autoplay />
    <div class="scanner__frame" />
  </div>
</template>

<style scoped>
.scanner {
  position: relative;
  width: 100%;
  max-width: 360px;
  margin-inline: auto;
  aspect-ratio: 1;
  border-radius: 16px;
  overflow: hidden;
  background: rgb(var(--v-theme-print-backdrop));
}

.scanner__video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.scanner__frame {
  position: absolute;
  inset: 18%;
  border: 3px solid rgba(255, 255, 255, 0.9);
  border-radius: 12px;
  box-shadow: 0 0 0 999px rgba(0, 0, 0, 0.35);
}
</style>
