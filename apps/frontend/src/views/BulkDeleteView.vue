<script setup lang="ts">
import { computed, ref } from 'vue'

import StepLayout from '../components/StepLayout.vue'
import SubPageBar from '../components/SubPageBar.vue'
import { useBack } from '../composables/useBack.ts'
import { useBulkDeleteCountsQuery, useBulkDeleteMutation } from '../composables/useBulkDelete.ts'
import { useStatsQuery } from '../composables/useStatsQuery.ts'
import { formatMegabytes } from '../lib/format.ts'
import { useConfirmStore } from '../stores/confirm.ts'
import { useNotificationStore } from '../stores/notification.ts'

const back = useBack({ name: 'settings' })
const confirm = useConfirmStore()
const notification = useNotificationStore()
const stats = useStatsQuery()
const counts = useBulkDeleteCountsQuery()
const bulkDelete = useBulkDeleteMutation()

/** `1か月` / `3か月` / `6か月` / `1年`, as the spec words the choices. */
const periodLabel = (months: number) => (months % 12 === 0 ? `${months / 12}年` : `${months}か月`)

const options = computed(() => counts.value.flatMap((query) => (query.data ? [query.data] : [])))
const months = ref<number>()
const chosen = computed(() => options.value.find((option) => option.months === months.value))

const storage = computed(() => stats.data.value?.storage)
const percentOf = (bytes: number) =>
  storage.value ? Math.min(100, (bytes / storage.value.limitBytes) * 100) : 0

const run = async () => {
  const option = chosen.value
  if (!option || option.count === 0) return
  const confirmed = await confirm.confirm({
    title: `${option.count}件のプリントを削除しますか？`,
    text: `${periodLabel(option.months)}以上前に登録したプリント${option.count}件と写真を、すべてのこどもと家族共通から削除します。元に戻せません。`,
    confirmText: '削除する',
    danger: true,
  })
  if (!confirmed) return
  bulkDelete.mutate(option.months, {
    onSuccess: ({ count }) => {
      notification.show(`${count}件のプリントを削除しました`)
      months.value = undefined
    },
  })
}
</script>

<!-- 5d -->
<template>
  <SubPageBar title="古いプリントを一括削除" icon="back" @navigate="back" />
  <StepLayout>
    <p class="text-body-2 text-medium-emphasis">
      すべてのこどもと家族共通から、登録日時が選んだ期間より前のプリントを削除します。
    </p>
    <v-card>
      <v-radio-group v-model="months" hide-details>
        <v-list class="py-0">
          <template v-for="(option, index) in options" :key="option.months">
            <v-divider v-if="index > 0" />
            <v-list-item @click="months = option.months">
              <template #prepend>
                <v-radio :value="option.months" :aria-label="periodLabel(option.months)" />
              </template>
              <v-list-item-title>{{ periodLabel(option.months) }}より前</v-list-item-title>
              <template #append>
                <span class="text-caption text-medium-emphasis">
                  {{ option.count }}件 · {{ formatMegabytes(option.bytes) }}MB
                </span>
              </template>
            </v-list-item>
          </template>
        </v-list>
      </v-radio-group>
    </v-card>
    <v-card v-if="storage" class="pa-4 d-flex flex-column ga-2">
      <div class="text-caption text-medium-emphasis">削除後の容量</div>
      <div class="storage-bar">
        <div
          class="bg-primary"
          :style="{ width: `${percentOf(storage.usedBytes - (chosen?.bytes ?? 0))}%` }"
        />
        <div
          class="bg-secondary opacity-50"
          :style="{ width: `${percentOf(chosen?.bytes ?? 0)}%` }"
        />
      </div>
      <div class="text-caption">
        {{ formatMegabytes(storage.usedBytes) }} →
        <b>{{ formatMegabytes(storage.usedBytes - (chosen?.bytes ?? 0)) }}</b> MB
      </div>
    </v-card>
    <template #actions>
      <v-btn
        color="error"
        size="x-large"
        block
        :text="chosen ? `${chosen.count}件を削除…` : '期間を選んでください'"
        :disabled="!chosen || chosen.count === 0"
        :loading="bulkDelete.isPending.value"
        @click="run"
      />
    </template>
  </StepLayout>
</template>

<style scoped>
.storage-bar {
  display: flex;
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  background: rgb(var(--v-theme-surface-light));
}
</style>
