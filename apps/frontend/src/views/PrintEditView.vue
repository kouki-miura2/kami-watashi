<script setup lang="ts">
import { LIMITS } from 'utils'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { ApiError, errorMessage } from '../api/errors.ts'
import PhotoSourceSheet from '../components/PhotoSourceSheet.vue'
import PhotoStrip from '../components/PhotoStrip.vue'
import PrintForm from '../components/PrintForm.vue'
import StepLayout from '../components/StepLayout.vue'
import StorageFullDialog from '../components/StorageFullDialog.vue'
import SubPageBar from '../components/SubPageBar.vue'
import { useBack } from '../composables/useBack.ts'
import { useChildrenQuery } from '../composables/useChildren.ts'
import { usePrintPhotoDraft } from '../composables/usePrintPhotoDraft.ts'
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
const id = computed(() => String(route.params.id))
const close = useBack({ name: 'print', params: { id: id.value } })
const notification = useNotificationStore()
const print = usePrintQuery(id)
const children = useChildrenQuery()
const stats = useStatsQuery()
const updatePrint = useUpdatePrintMutation()
const replacePhotos = useReplacePhotosMutation()
const photos = usePrintPhotoDraft()

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
    void photos.load(current.images.map((image) => image.id))
  },
  { immediate: true },
)
const titleValid = ref<boolean | null>(null)

const sourceSheetOpen = ref(false)
const startRetake = async () => {
  if (await photos.startRetake()) sourceSheetOpen.value = true
}
const addPhotos = (pick: () => Promise<Blob[]>) => {
  if (photos.photosLeft.value === 0 || saving.value || photos.busy.value) return
  sourceSheetOpen.value = false
  void photos.add(pick)
}

const storageFullOpen = ref(false)
const saving = computed(() => updatePrint.isPending.value || replacePhotos.isPending.value)
const canSave = computed(
  () =>
    form.value !== undefined &&
    !saving.value &&
    titleValid.value !== false &&
    !photos.busy.value &&
    photos.photos.value.length > 0,
)

const slotNameOf = (childId: string | null) =>
  toSlotCards(children.data.value ?? []).find((card) => card.param === slotParam(childId))?.slot
    .name ?? ''

const save = async () => {
  if (!canSave.value || !form.value || !print.data.value) return
  const movedFrom = print.data.value.childId
  try {
    const saved = await updatePrint.mutateAsync({ id: id.value, changes: form.value })
    if (saved.childId !== movedFrom) {
      notification.show(`${formatPrintLabel(slotNameOf(saved.childId), saved.seq)}になりました`)
    }
  } catch {
    return // Reported app-wide.
  }
  if (photos.changed.value) {
    try {
      await replacePhotos.mutateAsync({
        id: id.value,
        photos: photos.blobs(),
      })
    } catch (error) {
      // The other changes are saved; only the photos stay as they were.
      if (error instanceof ApiError && error.code === 'storage_limit') storageFullOpen.value = true
      else notification.show(errorMessage(error))
      return
    }
  }
  await close()
}
</script>

<!-- 4a, changing a print: the same form, with per-page photo editing and full retakes. -->
<template>
  <SubPageBar title="プリントを変更" icon="close" @navigate="close" />
  <v-form v-if="form" v-model="titleValid" class="fill-height" @submit.prevent="canSave && save()">
    <StepLayout>
      <PrintForm v-model="form">
        <template #photos>
          <section>
            <div class="field-label d-flex justify-space-between">
              <span>写真</span>
              <span>{{ photos.photos.value.length }}/{{ LIMITS.printImages }}</span>
            </div>
            <PhotoStrip
              :photos="photos.photos.value"
              :photos-left="0"
              :loading="photos.loading.value"
              :disabled="saving"
              @rotate="photos.rotate"
              @remove="photos.remove"
            />
            <v-progress-circular v-if="photos.loading.value" indeterminate size="24" class="mt-2" />
            <v-btn
              v-else-if="!photos.ready.value"
              variant="text"
              size="small"
              text="写真を再読み込み"
              @click="photos.load(print.data.value?.images.map((image) => image.id) ?? [])"
            />
            <template v-if="photos.retaking.value">
              <v-btn
                variant="text"
                size="small"
                prepend-icon="mdi-undo"
                text="撮り直しをやめる"
                :disabled="saving || photos.busy.value"
                class="mt-2"
                @click="photos.cancelRetake"
              />
            </template>
            <div class="d-flex flex-wrap ga-2 mt-2">
              <v-btn
                v-if="!photos.retaking.value"
                variant="outlined"
                size="small"
                prepend-icon="mdi-camera-retake-outline"
                text="写真をすべて撮り直す"
                :disabled="saving || photos.busy.value"
                @click="startRetake"
              />
              <v-btn
                variant="outlined"
                size="small"
                prepend-icon="mdi-plus"
                text="追加"
                :disabled="photos.photosLeft.value === 0 || saving || photos.busy.value"
                :loading="photos.loading.value"
                @click="sourceSheetOpen = true"
              />
            </div>
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
