import { LIMITS } from 'utils'
import { computed, onUnmounted, ref } from 'vue'

import { useNotificationStore } from '../stores/notification.ts'

/**
 * Photos being added to a print (registration, or retaking every page): optimized blobs in page
 * order, each with an object URL for its thumbnail, freed when removed or when the screen closes.
 */
export const usePhotoDraft = () => {
  const notification = useNotificationStore()
  const photos = ref<{ blob: Blob; url: string }[]>([])
  const loading = ref(false)

  const photosLeft = computed(() => LIMITS.printImages - photos.value.length)
  const totalBytes = computed(() => photos.value.reduce((sum, photo) => sum + photo.blob.size, 0))
  const blobs = () => photos.value.map((photo) => photo.blob)

  /** Adds what `pick` returns (the camera or gallery, `[]` when cancelled). */
  const add = async (pick: () => Promise<Blob[]>) => {
    loading.value = true
    try {
      const picked = await pick()
      photos.value.push(...picked.map((blob) => ({ blob, url: URL.createObjectURL(blob) })))
    } catch {
      notification.show('写真を読み込めませんでした')
    } finally {
      loading.value = false
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

  return { photos, loading, photosLeft, totalBytes, blobs, add, remove, clear }
}
