import { LIMITS } from 'utils'
import { computed, onUnmounted, ref } from 'vue'

import { rotatePhoto } from '../device/photos.ts'
import { useNotificationStore } from '../stores/notification.ts'

export interface DraftPhoto {
  /** The photo as optimized when taken or chosen; rotations start from it. */
  original: Blob
  /** Clockwise quarter turns applied (0–3). */
  quarterTurns: number
  /** What gets uploaded: `original`, rotated. */
  blob: Blob
  url: string
  rotating: boolean
}

/**
 * Photos being added to a print (registration, or retaking every page): optimized blobs in page
 * order, each with an object URL for its thumbnail, freed when removed or when the screen closes.
 */
export const usePhotoDraft = () => {
  const notification = useNotificationStore()
  const photos = ref<DraftPhoto[]>([])
  const loading = ref(false)

  const photosLeft = computed(() => LIMITS.printImages - photos.value.length)
  const totalBytes = computed(() => photos.value.reduce((sum, photo) => sum + photo.blob.size, 0))
  const blobs = () => photos.value.map((photo) => photo.blob)

  /** Adds what `pick` returns (the camera or gallery, `[]` when cancelled). */
  const add = async (pick: () => Promise<Blob[]>) => {
    loading.value = true
    try {
      const picked = await pick()
      photos.value.push(
        ...picked.map((blob) => ({
          original: blob,
          quarterTurns: 0,
          blob,
          url: URL.createObjectURL(blob),
          rotating: false,
        })),
      )
      return true
    } catch {
      notification.show('写真を読み込めませんでした')
      return false
    } finally {
      loading.value = false
    }
  }

  /** Turns a photo 90° clockwise; tap again to keep turning (the 4th tap is back to the start). */
  const rotate = async (index: number) => {
    const photo = photos.value[index]
    if (!photo || photo.rotating) return
    photo.rotating = true
    const quarterTurns = (photo.quarterTurns + 1) % 4
    try {
      const blob =
        quarterTurns === 0 ? photo.original : await rotatePhoto(photo.original, quarterTurns)
      // Removed (and its URL freed) meanwhile: nothing to update.
      if (!photos.value.includes(photo)) return
      URL.revokeObjectURL(photo.url)
      Object.assign(photo, { quarterTurns, blob, url: URL.createObjectURL(blob) })
    } catch {
      notification.show('写真を回転できませんでした')
    } finally {
      photo.rotating = false
    }
  }

  const remove = (index: number) => {
    const [removed] = photos.value.splice(index, 1)
    if (removed) URL.revokeObjectURL(removed.url)
  }

  const clear = () => {
    photos.value.forEach((photo) => URL.revokeObjectURL(photo.url))
    photos.value = []
  }
  onUnmounted(clear)

  return { photos, loading, photosLeft, totalBytes, blobs, add, rotate, remove, clear }
}
