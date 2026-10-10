import { computed, ref } from 'vue'

import { apiClient } from '../api/client.ts'
import { useConfirmStore } from '../stores/confirm.ts'
import { usePhotoDraft } from './usePhotoDraft.ts'

/** Saved pages and newly added pages share one draft; nothing is uploaded until saving. */
export const usePrintPhotoDraft = () => {
  const draft = usePhotoDraft()
  const confirm = useConfirmStore()
  const originalPhotos = ref<Blob[]>([])
  const ready = ref(false)
  const retaking = ref(false)
  const busy = computed(
    () => !ready.value || draft.loading.value || draft.photos.value.some((photo) => photo.rotating),
  )
  const changed = computed(
    () =>
      draft.photos.value.length !== originalPhotos.value.length ||
      draft.photos.value.some((photo, index) => photo.blob !== originalPhotos.value[index]),
  )

  const load = async (imageIds: string[]) => {
    if (ready.value || draft.loading.value) return
    const loaded = await draft.add(() =>
      Promise.all(
        imageIds.map(async (id) => (await apiClient.images[':id'].$get({ param: { id } })).blob()),
      ),
    )
    if (loaded) {
      originalPhotos.value = draft.blobs()
      ready.value = true
    }
  }

  const remove = async (index: number) => {
    const photo = draft.photos.value[index]
    if (!photo || busy.value) return
    const confirmed = await confirm.confirm({
      title: `${index + 1}ページ目の写真を削除しますか？`,
      text: '「保存する」を押すと、この写真が削除されます。',
      confirmText: '削除する',
      danger: true,
    })
    const currentIndex = draft.photos.value.indexOf(photo)
    if (confirmed && currentIndex >= 0) draft.remove(currentIndex)
  }

  const startRetake = async () => {
    if (busy.value) return false
    const confirmed = await confirm.confirm({
      title: '写真をすべて撮り直しますか？',
      text: '編集中の写真をすべて取り除き、新しい写真に置き換えます。変更は「保存する」を押すと反映されます。',
      confirmText: '撮り直す',
      danger: true,
    })
    if (!confirmed) return false
    draft.clear()
    retaking.value = true
    return true
  }

  const cancelRetake = async () => {
    if (busy.value) return
    draft.clear()
    await draft.add(async () => originalPhotos.value)
    retaking.value = false
  }

  return { ...draft, ready, busy, changed, retaking, load, remove, startRetake, cancelRetake }
}
