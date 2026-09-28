<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import TabPage from '../components/TabPage.vue'
import { useChildrenQuery } from '../composables/useChildren.ts'
import { formatJstDateWithWeekday } from '../lib/format.ts'
import { toSlotCards } from '../lib/slots.ts'

const router = useRouter()
const children = useChildrenQuery()

const cards = computed(() => toSlotCards(children.data.value ?? []))
const hasChildren = computed(() => cards.value.some((card) => card.slot.id !== null))
const today = formatJstDateWithWeekday(new Date())

/** A slot's prints; from the mitene badge, only the prints someone asked this member to see. */
const openSlot = (slot: string, onlyMitene = false) =>
  router.push({
    name: 'prints',
    params: { slot },
    query: onlyMitene ? { mitene: 'requested' } : {},
  })
</script>

<!-- 2a: one card per child, and the family-common slot last. -->
<template>
  <TabPage title="こども" :overline="today">
    <div v-if="children.isPending.value" class="d-flex justify-center py-8">
      <v-progress-circular indeterminate />
    </div>
    <div v-else class="d-flex flex-column ga-3">
      <v-card
        v-if="!hasChildren"
        :to="{ name: 'children' }"
        prepend-icon="mdi-account-plus-outline"
        title="こどもを登録"
        subtitle="こどもごとにプリントを整理できます"
        append-icon="mdi-chevron-right"
        class="py-2"
      />
      <v-card v-for="card in cards" :key="card.param" class="pa-4" @click="openSlot(card.param)">
        <div class="d-flex align-center ga-4">
          <v-avatar :color="card.color" rounded="lg" size="48" class="text-h6 font-weight-black">
            {{ card.initial }}
          </v-avatar>
          <div class="flex-grow-1" style="min-width: 0">
            <div class="text-h6 font-weight-bold text-truncate">{{ card.slot.name }}</div>
            <div class="text-caption text-medium-emphasis">
              今週
              <span class="font-weight-bold text-high-emphasis">{{ card.slot.weekCount }}</span> 件
            </div>
          </div>
          <v-chip
            v-if="card.slot.miteneCount > 0"
            color="secondary"
            variant="flat"
            prepend-icon="mdi-eye"
            :text="`見てね ${card.slot.miteneCount}`"
            @click.stop="openSlot(card.param, true)"
          />
          <v-icon icon="mdi-chevron-right" color="medium-emphasis" />
        </div>
      </v-card>
    </div>
  </TabPage>
  <v-fab
    app
    location="bottom end"
    extended
    color="primary"
    prepend-icon="mdi-camera-outline"
    text="プリントを登録"
    :to="{ name: 'print-new' }"
  />
</template>
