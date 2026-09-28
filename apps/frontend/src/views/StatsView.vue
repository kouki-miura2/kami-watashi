<script setup lang="ts">
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from 'chart.js'
import { computed, ref } from 'vue'
import { Bar } from 'vue-chartjs'

import TabPage from '../components/TabPage.vue'
import { useChildrenQuery } from '../composables/useChildren.ts'
import { useStatsQuery } from '../composables/useStatsQuery.ts'
import { formatMegabytes } from '../lib/format.ts'
import { toSlotCards } from '../lib/slots.ts'
import { toRegistrationChart, usagePercent } from '../lib/stats.ts'

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend)

const stats = useStatsQuery()
const children = useChildrenQuery()
const unit = ref<'week' | 'month'>('week')

const chart = computed(() => {
  if (!stats.data.value) return null
  const slots = toSlotCards(children.data.value ?? []).map((card) => ({
    param: card.param,
    name: card.slot.name,
    color: card.color,
  }))
  const periods = unit.value === 'week' ? stats.data.value.weekly : stats.data.value.monthly
  return toRegistrationChart(periods, slots, unit.value)
})
const storage = computed(() => stats.data.value?.storage)

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  // Tapping a bar shows every slot's count for that period.
  interaction: { mode: 'index' as const, intersect: false },
  plugins: { legend: { position: 'bottom' as const, labels: { boxWidth: 10 } } },
  scales: {
    x: { stacked: true, grid: { display: false } },
    y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } },
  },
}
</script>

<!-- 6b -->
<template>
  <TabPage title="集計">
    <div v-if="stats.isPending.value" class="d-flex justify-center py-8">
      <v-progress-circular indeterminate />
    </div>
    <div v-else class="d-flex flex-column ga-4">
      <v-card class="pa-4 d-flex flex-column ga-3">
        <div class="d-flex justify-space-between align-center">
          <span class="font-weight-bold">登録数</span>
          <v-btn-toggle
            v-model="unit"
            mandatory
            divided
            variant="outlined"
            color="primary"
            density="compact"
          >
            <v-btn value="week" text="週" />
            <v-btn value="month" text="月" />
          </v-btn-toggle>
        </div>
        <div style="height: 220px">
          <Bar v-if="chart" :data="chart" :options="chartOptions" aria-label="登録数のグラフ" />
        </div>
        <p class="text-caption text-medium-emphasis">
          いま登録されているプリントを、登録日で数えています（削除したプリントは含みません）。
        </p>
      </v-card>

      <v-card v-if="storage" class="pa-4 d-flex align-center ga-4">
        <v-progress-circular
          :model-value="usagePercent(storage.usedBytes, storage.limitBytes)"
          :size="96"
          :width="12"
          color="primary"
          bg-color="surface-light"
        >
          <span class="text-h6 font-weight-bold">
            {{ usagePercent(storage.usedBytes, storage.limitBytes) }}%
          </span>
        </v-progress-circular>
        <div class="d-flex flex-column ga-1">
          <span class="font-weight-bold">容量使用率</span>
          <span class="text-body-2">
            {{ formatMegabytes(storage.usedBytes) }} / {{ formatMegabytes(storage.limitBytes) }} MB
          </span>
          <v-btn
            variant="text"
            color="link"
            size="small"
            text="古いプリントを一括削除 ›"
            class="px-0 align-self-start"
            :to="{ name: 'bulk-delete' }"
          />
        </div>
      </v-card>
    </div>
  </TabPage>
</template>
