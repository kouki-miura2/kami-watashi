<script setup lang="ts">
import { toJstDateString } from 'utils'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import PrintFilterSheet from '../components/PrintFilterSheet.vue'
import PrintThumb from '../components/PrintThumb.vue'
import SubPageBar from '../components/SubPageBar.vue'
import { useBack } from '../composables/useBack.ts'
import { useChildrenQuery } from '../composables/useChildren.ts'
import { usePrintsQuery } from '../composables/usePrints.ts'
import { useTopicsQuery } from '../composables/useTopics.ts'
import { formatJstMonthDayTime, formatMonthDay } from '../lib/format.ts'
import {
  activeConditions,
  type FilterCondition,
  filterFromQuery,
  filterToQuery,
  type PrintFilter,
  responseLabel,
  withoutCondition,
} from '../lib/print-filter.ts'
import { groupByDue } from '../lib/print-format.ts'
import { slotParam } from '../lib/slots.ts'

const route = useRoute()
const router = useRouter()
const back = useBack({ name: 'home' })
const children = useChildrenQuery()
const topics = useTopicsQuery()

const slot = computed(() => String(route.params.slot))
const slotName = computed(
  () => children.data.value?.find((candidate) => slotParam(candidate.id) === slot.value)?.name,
)

// The order and filters live in the URL, so back navigation and the home badge restore them.
const filter = computed(() => filterFromQuery(route.query))
const setFilter = (next: PrintFilter) => router.replace({ query: filterToQuery(next) })
const sort = computed({
  get: () => filter.value.sort,
  set: (value) => setFilter({ ...filter.value, sort: value }),
})

const prints = usePrintsQuery(slot, filter)
const conditions = computed(() =>
  activeConditions(filter.value, (id) => topics.data.value?.find((topic) => topic.id === id)?.name),
)
const removeCondition = (condition: FilterCondition) =>
  setFilter(withoutCondition(filter.value, condition))
const filterSheetOpen = ref(false)

/** Newest first as one section, or by due date in 期限切れ・未対応 / 今週 / それ以降 (2c). */
const sections = computed(() =>
  sort.value === 'created'
    ? [{ kind: 'all', label: '', items: prints.data.value ?? [] }]
    : groupByDue(prints.data.value ?? [], toJstDateString(new Date())),
)

/** A print's topic names, shown as chips after its title. */
const topicNames = (topicIds: string[]) =>
  topicIds.flatMap((id) => {
    const name = topics.data.value?.find((topic) => topic.id === id)?.name
    return name ? [name] : []
  })

const openPrint = (id: string) => router.push({ name: 'print', params: { id } })
</script>

<!-- 2b (newest first) / 2c (by due date) -->
<template>
  <SubPageBar :title="slotName ? `${slotName}のプリント` : ''" icon="back" @navigate="back">
    <template #actions>
      <v-btn icon="mdi-tune-variant" aria-label="絞り込み" @click="filterSheetOpen = true" />
    </template>
  </SubPageBar>

  <div class="px-4 pb-2 d-flex flex-column ga-2">
    <v-btn-toggle
      v-model="sort"
      mandatory
      divided
      variant="outlined"
      color="primary"
      density="comfortable"
      class="w-100"
    >
      <v-btn value="created" text="登録日時順" class="flex-1-1" />
      <v-btn value="due" text="期限順" class="flex-1-1" />
    </v-btn-toggle>
    <div v-if="conditions.length > 0" class="d-flex flex-wrap ga-2">
      <v-chip
        v-for="{ condition, label } in conditions"
        :key="label"
        :text="label"
        color="primary"
        variant="flat"
        size="small"
        closable
        @click:close="removeCondition(condition)"
      />
    </div>
  </div>

  <div class="pb-16">
    <div v-if="prints.isPending.value" class="d-flex justify-center py-8">
      <v-progress-circular indeterminate />
    </div>
    <v-empty-state
      v-else-if="(prints.data.value ?? []).length === 0"
      icon="mdi-file-document-outline"
      :text="
        conditions.length > 0 || sort === 'due'
          ? '条件に合うプリントはありません'
          : 'プリントはまだありません'
      "
    />

    <v-list v-else class="py-0" bg-color="transparent">
      <template v-for="section in sections" :key="section.kind">
        <div
          v-if="section.label"
          class="d-flex align-center ga-2 px-4 pt-4 pb-2 text-caption font-weight-bold"
          :class="{ 'text-error': section.kind === 'overdue' }"
        >
          <span class="text-no-wrap">{{ section.label }}</span>
          <v-divider />
        </div>
        <template v-for="(print, index) in section.items" :key="print.id">
          <v-divider v-if="!section.label || index > 0" />
          <v-list-item class="py-3" :class="{ unread: !print.isRead }" @click="openPrint(print.id)">
            <template #prepend>
              <PrintThumb :image-id="print.coverImageId" :pages="print.imageCount" class="mr-3" />
            </template>
            <div class="d-flex align-center ga-2 text-caption text-medium-emphasis">
              <span v-if="!print.isRead" class="unread-dot" aria-label="未読" />
              <span>{{ String(print.seq).padStart(5, '0') }}</span>
              <span>{{ formatJstMonthDayTime(new Date(print.createdAt)) }}</span>
            </div>
            <!-- The topics follow the title, wrapping onto the next line when they don't fit. -->
            <div class="d-flex flex-wrap align-center ga-1">
              <span
                class="text-body-1 text-truncate mr-1"
                style="max-width: 100%"
                :class="print.title ? (print.isRead ? '' : 'font-weight-bold') : 'text-disabled'"
                >{{ print.title ?? 'タイトルなし' }}</span
              >
              <v-chip
                v-for="name in topicNames(print.topicIds)"
                :key="name"
                :text="name"
                variant="outlined"
                size="x-small"
              />
            </div>
            <div class="d-flex flex-wrap align-center ga-1 mt-1">
              <span
                v-if="print.dueOn"
                class="text-caption"
                :class="{ 'text-error font-weight-bold': section.kind === 'overdue' }"
              >
                <v-icon icon="mdi-calendar-outline" size="14" />
                {{ formatMonthDay(print.dueOn) }}まで
              </span>
              <v-chip
                v-if="print.responseStatus !== 'none'"
                :color="print.responseStatus"
                variant="flat"
                size="x-small"
                label
                :text="responseLabel(print.responseStatus)"
              />
              <v-chip
                v-if="print.miteneStatus === 'requested'"
                color="secondary"
                variant="flat"
                size="x-small"
                label
                :text="print.miteneFromName ? `見てね・${print.miteneFromName}` : '見てね'"
              />
            </div>
          </v-list-item>
        </template>
      </template>
    </v-list>
  </div>

  <v-fab app location="bottom end" color="primary" :to="{ name: 'print-new', query: { slot } }">
    <!-- Icon-only (design 2b); the hidden label names the link (an aria-label would land on the wrapper). -->
    <v-icon icon="mdi-camera-outline" />
    <span class="d-sr-only">プリントを登録</span>
  </v-fab>

  <PrintFilterSheet v-model="filterSheetOpen" :slot="slot" :filter="filter" @apply="setFilter" />
</template>

<style scoped>
.unread {
  background: rgba(var(--v-theme-surface), 0.6);
}

.unread-dot {
  width: 8px;
  height: 8px;
  border-radius: 4px;
  background: rgb(var(--v-theme-secondary));
}
</style>
