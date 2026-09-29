<script setup lang="ts">
import { LIMITS } from 'utils'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { ApiError, errorMessage } from '../api/errors.ts'
import PhotoSourceSheet from '../components/PhotoSourceSheet.vue'
import PhotoStrip from '../components/PhotoStrip.vue'
import PrintForm from '../components/PrintForm.vue'
import PrintThumb from '../components/PrintThumb.vue'
import StepLayout from '../components/StepLayout.vue'
import StorageFullDialog from '../components/StorageFullDialog.vue'
import SubPageBar from '../components/SubPageBar.vue'
import { useBack } from '../composables/useBack.ts'
import { useChildrenQuery } from '../composables/useChildren.ts'
import { usePhotoDraft } from '../composables/usePhotoDraft.ts'
import {
  type PrintFormValues,
  usePrintQuery,
  useReplacePhotosMutation,
  useUpdatePrintMutation,
} from '../composables/usePrints.ts'
import { useStatsQuery } from '../composables/useStatsQuery.ts'
import { choosePhotos, takePhoto } from '../device/photos.ts'
import { formatPrintLabel } from '../lib/print-format.ts'
import { slotParam, toSlotCards } from '../lib/slots.ts'
import { useNotificationStore } from '../stores/notification.ts'

const route = useRoute()
const router = useRouter()
const id = computed(() => String(route.params.id))
const close = useBack({ name: 'print', params: { id: id.value } })
const notification = useNotificationStore()
const print = usePrintQuery(id)
const children = useChildrenQuery()
const stats = useStatsQuery()
const updatePrint = useUpdatePrintMutation()
const replacePhotos = useReplacePhotosMutation()

const form = ref<PrintFormValues>()
// Filled from the print once, so a background refetch doesn't overwrite what's being edited.
watch(
  () => print.data.value,
  (current) => {
    if (!current || form.value) return
    form.value = {
      slot: slotParam(current.childId),
      title: current.title ?? '',
      receivedOn: current.receivedOn ?? '',
      dueOn: current.dueOn ?? '',
      topicIds: [...current.topicIds],
      responseStatus: current.responseStatus,
    }
  },
  { immediate: true },
)
const titleValid = ref<boolean | null>(null)

// Retaking replaces every page at once (spec: no per-page editing).
const retaking = ref(false)
const photos = usePhotoDraft()
const sourceSheetOpen = ref(false)
const startRetake = () => {
  retaking.value = true
  sourceSheetOpen.value = true
}
const cancelRetake = () => {
  retaking.value = false
  photos.clear()
}
const addPhotos = (pick: () => Promise<Blob[]>) => {
  sourceSheetOpen.value = false
  void photos.add(pick)
}

const storageFullOpen = ref(false)
const saving = computed(() => updatePrint.isPending.value || replacePhotos.isPending.value)
const canSave = computed(
  () =>
    form.value !== undefined &&
    titleValid.value !== false &&
    (!retaking.value || photos.photos.value.length > 0),
)

const slotNameOf = (childId: string | null) =>
  toSlotCards(children.data.value ?? []).find((card) => card.param === slotParam(childId))?.slot
    .name ?? ''

const save = async () => {
  if (!form.value || !print.data.value) return
  const movedFrom = print.data.value.childId
  try {
    const saved = await updatePrint.mutateAsync({ id: id.value, changes: form.value })
    if (saved.childId !== movedFrom) {
      notification.show(`${formatPrintLabel(slotNameOf(saved.childId), saved.seq)}になりました`)
    }
  } catch {
    return // Reported app-wide.
  }
  if (retaking.value) {
    try {
      await replacePhotos.mutateAsync({ id: id.value, photos: photos.blobs() })
    } catch (error) {
      // The other changes are saved; only the photos stay as they were.
      if (error instanceof ApiError && error.code === 'storage_limit') storageFullOpen.value = true
      else notification.show(errorMessage(error))
      return
    }
  }
  await router.replace({ name: 'print', params: { id: id.value } })
}
</script>

<!-- 4a, changing a print: the same form, plus retaking every photo. -->
<template>
  <SubPageBar title="プリントを変更" icon="close" @navigate="close" />
  <v-form v-if="form" v-model="titleValid" class="fill-height" @submit.prevent="canSave && save()">
    <StepLayout>
      <PrintForm v-model="form">
        <template #photos>
          <section>
            <div class="field-label d-flex justify-space-between">
              <span>写真</span>
              <span v-if="retaking">{{ photos.photos.value.length }}/{{ LIMITS.printImages }}</span>
            </div>
            <template v-if="retaking">
              <PhotoStrip
                :photos="photos.photos.value"
                :photos-left="photos.photosLeft.value"
                :loading="photos.loading.value"
                @add="sourceSheetOpen = true"
                @rotate="photos.rotate"
                @remove="photos.remove"
              />
              <v-btn
                variant="text"
                size="small"
                prepend-icon="mdi-undo"
                text="撮り直しをやめる"
                class="mt-2"
                @click="cancelRetake"
              />
            </template>
            <template v-else>
              <div class="d-flex flex-wrap ga-2">
                <PrintThumb
                  v-for="image in print.data.value?.images"
                  :key="image.id"
                  :image-id="image.id"
                  :width="72"
                  :height="92"
                />
              </div>
              <v-btn
                variant="outlined"
                size="small"
                prepend-icon="mdi-camera-retake-outline"
                text="写真をすべて撮り直す"
                class="mt-2"
                @click="startRetake"
              />
            </template>
          </section>
        </template>
      </PrintForm>

      <template #actions>
        <v-btn
          type="submit"
          color="primary"
          size="x-large"
          block
          text="保存する"
          :disabled="!canSave"
          :loading="saving"
        />
      </template>
    </StepLayout>
  </v-form>
  <div v-else class="d-flex justify-center py-8">
    <v-progress-circular indeterminate />
  </div>

  <PhotoSourceSheet
    v-model="sourceSheetOpen"
    @take="addPhotos(takePhoto)"
    @choose="addPhotos(() => choosePhotos(photos.photosLeft.value))"
  />
  <StorageFullDialog
    v-if="stats.data.value"
    v-model="storageFullOpen"
    :used-bytes="stats.data.value.storage.usedBytes"
    :limit-bytes="stats.data.value.storage.limitBytes"
    :added-bytes="photos.totalBytes.value"
    retake
  />
</template>
