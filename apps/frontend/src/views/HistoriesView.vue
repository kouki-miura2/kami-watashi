<script setup lang="ts">
import { formatJstDateTime } from 'utils'
import { computed } from 'vue'

import TabPage from '../components/TabPage.vue'
import { useHistoriesQuery } from '../composables/useHistoriesQuery.ts'
import { formatHistory } from '../lib/history.ts'

const histories = useHistoriesQuery()

const lines = computed(() =>
  (histories.data.value?.pages ?? []).flatMap((page) =>
    page.items.map((item) => {
      // `2026.09.27 12:40` → date `09.27` over time `12:40` in the timeline's left column.
      const [date, time] = formatJstDateTime(new Date(item.createdAt)).split(' ')
      return { id: item.id, date: date!.slice(5), time: time!, ...formatHistory(item) }
    }),
  ),
)

/** Timeline dot colors (design 6a): registered = ink, changed = indigo, deleted = red. */
const DOT_COLORS = {
  create: 'rgb(var(--v-theme-primary))',
  update: '#2F5D8A',
  delete: 'rgb(var(--v-theme-error))',
} as const

// `v-infinite-scroll`'s contract: load, then report whether more remain.
const loadMore = async ({ done }: { done: (status: 'ok' | 'empty' | 'error') => void }) => {
  if (!histories.hasNextPage.value) return done('empty')
  const result = await histories.fetchNextPage()
  done(result.isError ? 'error' : histories.hasNextPage.value ? 'ok' : 'empty')
}
</script>

<!-- 6a. Deleted prints stay in the history, so entries don't link to them. -->
<template>
  <TabPage title="履歴">
    <div v-if="histories.isPending.value" class="d-flex justify-center py-8">
      <v-progress-circular indeterminate />
    </div>
    <v-empty-state v-else-if="lines.length === 0" icon="mdi-history" text="まだ履歴はありません" />
    <v-infinite-scroll v-else :items="lines" empty-text="" @load="loadMore">
      <div v-for="line in lines" :key="line.id" class="entry">
        <div class="entry__time text-caption text-medium-emphasis">
          {{ line.date }}<br /><span class="text-high-emphasis">{{ line.time }}</span>
        </div>
        <div class="entry__rail">
          <span class="entry__dot" :style="{ background: DOT_COLORS[line.kind] }" />
          <span class="entry__line" />
        </div>
        <div class="entry__text text-body-2">
          <b>{{ line.who }}</b
          >が{{ line.text }}
          <div v-if="line.detail" class="text-caption text-medium-emphasis">{{ line.detail }}</div>
        </div>
      </div>
    </v-infinite-scroll>
  </TabPage>
</template>

<style scoped>
.entry {
  display: grid;
  grid-template-columns: 44px 14px minmax(0, 1fr);
  gap: 8px;
  min-height: 56px;
}

.entry__time {
  text-align: right;
  line-height: 1.3;
  padding-top: 3px;
}

.entry__rail {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.entry__dot {
  width: 10px;
  height: 10px;
  border-radius: 5px;
  margin-top: 5px;
  flex: none;
}

.entry__line {
  flex: 1;
  width: 1px;
  background: rgba(var(--v-border-color), var(--v-border-opacity));
}

.entry__text {
  padding-bottom: 12px;
  line-height: 1.6;
}
</style>
