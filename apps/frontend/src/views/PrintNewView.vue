<script setup lang="ts">
import { LIMITS, toJstDateString } from 'utils'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { ApiError, errorMessage } from '../api/errors.ts'
import PhotoSourceSheet from '../components/PhotoSourceSheet.vue'
import PhotoStrip from '../components/PhotoStrip.vue'
import PrintForm from '../components/PrintForm.vue'
import StepLayout from '../components/StepLayout.vue'
import StorageFullDialog from '../components/StorageFullDialog.vue'
import SubPageBar from '../components/SubPageBar.vue'
import { useBack } from '../composables/useBack.ts'
import { usePhotoDraft } from '../composables/usePhotoDraft.ts'
import { type PrintFormValues, useCreatePrintMutation } from '../composables/usePrints.ts'
import { useStatsQuery } from '../composables/useStatsQuery.ts'
import { choosePhotos, takePhoto } from '../device/photos.ts'
import { formatMegabytes } from '../lib/format.ts'
import { useNotificationStore } from '../stores/notification.ts'

const route = useRoute()
const router = useRouter()
const close = useBack({ name: 'home' })
const notification = useNotificationStore()
const stats = useStatsQuery()
const createPrint = useCreatePrintMutation()

const form = ref<PrintFormValues>({
  // From a slot's print list, that slot is chosen already.
  slot: typeof route.query.slot === 'string' ? route.query.slot : '',
  title: '',
  receivedOn: toJstDateString(new Date()),
  dueOn: '',
  topicIds: [],
  responseStatus: 'none',
})
const titleValid = ref<boolean | null>(null)

// Photos (4b) are required and come first, so the source sheet opens right away.
const photos = usePhotoDraft()
const sourceSheetOpen = ref(true)
const addPhotos = (pick: () => Promise<Blob[]>) => {
  sourceSheetOpen.value = false
  void photos.add(pick)
}

const storageFullOpen = ref(false)
const canSubmit = computed(
  () => form.value.slot !== '' && photos.photos.value.length > 0 && titleValid.value !== false,
)

const submit = () =>
  createPrint.mutate(
    { ...form.value, photos: photos.blobs() },
    {
      onSuccess: () => router.replace({ name: 'prints', params: { slot: form.value.slot } }),
      // The form keeps everything entered, so the user can free up space and try again.
      onError: (error) => {
        if (error instanceof ApiError && error.code === 'storage_limit')
          storageFullOpen.value = true
        else notification.show(errorMessage(error))
      },
    },
  )
</script>

<!-- 4a -->
<template>
  <SubPageBar title="プリントを登録" icon="close" @navigate="close" />
  <v-form v-model="titleValid" class="fill-height" @submit.prevent="canSubmit && submit()">
    <StepLayout>
      <PrintForm v-model="form">
        <template #photos>
          <section>
            <div class="field-label d-flex justify-space-between">
              <span>写真<span class="text-link">*</span></span>
              <span>{{ photos.photos.value.length }}/{{ LIMITS.printImages }}</span>
            </div>
            <PhotoStrip
              :photos="photos.photos.value"
              :photos-left="photos.photosLeft.value"
              :loading="photos.loading.value"
              @add="sourceSheetOpen = true"
              @rotate="photos.rotate"
              @remove="photos.remove"
            />
          </section>
        </template>
      </PrintForm>

      <template #actions>
        <div
          v-if="stats.data.value"
          class="d-flex justify-space-between text-caption text-medium-emphasis"
        >
          <span>
            容量 {{ formatMegabytes(stats.data.value.storage.usedBytes) }} /
            {{ formatMegabytes(stats.data.value.storage.limitBytes) }} MB
          </span>
          <span v-if="photos.totalBytes.value > 0">
            +{{ formatMegabytes(photos.totalBytes.value) }} MB
          </span>
        </div>
        <v-btn
          type="submit"
          color="primary"
          size="x-large"
          block
          text="登録する"
          :disabled="!canSubmit"
          :loading="createPrint.isPending.value"
        />
      </template>
    </StepLayout>
  </v-form>

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
  />
</template>
