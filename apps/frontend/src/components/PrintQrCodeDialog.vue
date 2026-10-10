<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { PrintQrCode } from '../composables/usePrintQrCodes.ts'
import { qrCodeLink } from '../lib/qr-codes.ts'

const props = defineProps<{ codes: PrintQrCode[]; loading: boolean }>()
const open = defineModel<boolean>({ required: true })
const selected = ref<number>()
watch(open, () => {
  selected.value = undefined
})
const code = computed(() =>
  props.codes.length === 1 ? props.codes[0] : props.codes[selected.value ?? -1],
)
const link = computed(() => (code.value ? qrCodeLink(code.value.text) : undefined))
</script>

<template>
  <v-dialog v-model="open" max-width="480" :persistent="loading">
    <v-card :title="loading ? 'QRコードを読み取り中' : code ? 'QRコードの内容' : 'QRコードを選択'">
      <v-card-text v-if="loading" class="text-center" role="status">
        <v-progress-circular indeterminate color="primary" />
      </v-card-text>
      <v-card-text v-else-if="code">
        <div class="text-body-small text-medium-emphasis mb-2">{{ code.page }}ページ目</div>
        <div class="qr-content text-body-medium mb-2">{{ code.text }}</div>
      </v-card-text>
      <v-list v-else>
        <v-list-item v-for="(item, index) in codes" :key="index" @click="selected = index">
          <template #title>
            <span class="text-body-medium"
              >QRコード {{ index + 1 }}（{{ item.page }}ページ目）</span
            >
          </template>
          <div class="qr-content text-body-small text-medium-emphasis mb-2">{{ item.text }}</div>
        </v-list-item>
      </v-list>
      <v-card-actions v-if="!loading">
        <v-btn v-if="code && codes.length > 1" text="一覧へ戻る" @click="selected = undefined" />
        <v-spacer />
        <v-btn text="閉じる" @click="open = false" />
        <v-btn
          v-if="link"
          color="primary"
          text="開く"
          :href="link"
          target="_blank"
          rel="noopener noreferrer"
        />
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.qr-content {
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
</style>
