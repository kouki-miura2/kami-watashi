<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import MiteneSheet from '../components/MiteneSheet.vue'
import MovePrintDialog from '../components/MovePrintDialog.vue'
import PhotoViewer from '../components/PhotoViewer.vue'
import PrintInfoSheet from '../components/PrintInfoSheet.vue'
import ResponseStatusSheet from '../components/ResponseStatusSheet.vue'
import { useBack } from '../composables/useBack.ts'
import { useChildrenQuery } from '../composables/useChildren.ts'
import { useMembersQuery } from '../composables/useMembers.ts'
import {
  useDeletePrintMutation,
  usePrintQuery,
  useSendMiteneMutation,
  useUpdatePrintMutation,
} from '../composables/usePrints.ts'
import { useTopicsQuery } from '../composables/useTopics.ts'
import { type ResponseStatus, responseLabel } from '../lib/print-filter.ts'
import { formatPrintLabel } from '../lib/print-format.ts'
import { slotParam, toSlotCards } from '../lib/slots.ts'
import { useConfirmStore } from '../stores/confirm.ts'
import { useNotificationStore } from '../stores/notification.ts'

const route = useRoute()
const router = useRouter()
const back = useBack({ name: 'home' })
const confirm = useConfirmStore()
const notification = useNotificationStore()

const id = computed(() => String(route.params.id))
const print = usePrintQuery(id)
const children = useChildrenQuery()
const topics = useTopicsQuery()
const members = useMembersQuery()
const updatePrint = useUpdatePrintMutation()
const deletePrint = useDeletePrintMutation()
const sendMitene = useSendMiteneMutation()

const slots = computed(() =>
  toSlotCards(children.data.value ?? []).map((card) => ({
    param: card.param,
    name: card.slot.name,
  })),
)
const slotNameOf = (childId: string | null) =>
  slots.value.find((slot) => slot.param === slotParam(childId))?.name ?? ''
const label = computed(() =>
  print.data.value
    ? formatPrintLabel(slotNameOf(print.data.value.childId), print.data.value.seq)
    : '',
)
const topicNames = computed(() =>
  (print.data.value?.topicIds ?? []).flatMap((topicId) => {
    const topic = topics.data.value?.find((candidate) => candidate.id === topicId)
    return topic ? [topic.name] : []
  }),
)
const otherMembers = computed(() => (members.data.value ?? []).filter((member) => !member.isMe))

const miteneOpen = ref(false)
const responseOpen = ref(false)
const infoOpen = ref(false)
const moveOpen = ref(false)

const send = (memberIds: string[]) =>
  sendMitene.mutate(
    { id: id.value, memberIds },
    {
      onSuccess: () => {
        miteneOpen.value = false
        notification.show('見てねを送りました')
      },
    },
  )

const setResponse = (responseStatus: ResponseStatus) => {
  responseOpen.value = false
  if (responseStatus !== print.data.value?.responseStatus) {
    updatePrint.mutate({ id: id.value, changes: { responseStatus } })
  }
}

// Moving gives the print the next number in the new slot, shown once it's done.
const move = (slot: string) =>
  updatePrint.mutate(
    { id: id.value, changes: { slot } },
    {
      onSuccess: (moved) => {
        moveOpen.value = false
        notification.show(`${formatPrintLabel(slotNameOf(moved.childId), moved.seq)}になりました`)
      },
    },
  )

const remove = async () => {
  const current = print.data.value
  if (!current) return
  const title = current.title ? `「${current.title}」` : ''
  const confirmed = await confirm.confirm({
    title: 'このプリントを削除しますか？',
    text: `${label.value}${title}と写真${current.images.length}枚を削除します。元に戻せません。`,
    confirmText: '削除する',
    danger: true,
  })
  if (!confirmed) return
  const slot = slotParam(current.childId)
  deletePrint.mutate(id.value, {
    onSuccess: () => router.replace({ name: 'prints', params: { slot } }),
  })
}
</script>

<!-- 3a: the photo is the focus, on a dark backdrop. Opening it marks it read (and a mitene 見たよ). -->
<template>
  <div class="detail bg-print-backdrop">
    <div class="d-flex align-start pa-2 ga-1">
      <v-btn icon="mdi-arrow-left" variant="text" aria-label="戻る" @click="back" />
      <div class="flex-grow-1 pt-1" style="min-width: 0">
        <div class="text-caption opacity-70">{{ label }}</div>
        <div class="text-subtitle-1 font-weight-bold text-truncate">
          {{ print.data.value?.title ?? 'タイトルなし' }}
        </div>
      </div>
      <v-menu>
        <template #activator="{ props: menu }">
          <v-btn v-bind="menu" icon="mdi-dots-vertical" variant="text" aria-label="操作" />
        </template>
        <v-list>
          <v-list-item
            title="変更"
            prepend-icon="mdi-pencil-outline"
            :to="{ name: 'print-edit', params: { id } }"
          />
          <v-list-item
            title="こどもを付け替え"
            prepend-icon="mdi-swap-horizontal"
            @click="moveOpen = true"
          />
          <v-divider />
          <v-list-item
            title="削除"
            prepend-icon="mdi-delete-outline"
            base-color="error"
            @click="remove"
          />
        </v-list>
      </v-menu>
    </div>

    <v-sheet
      v-if="print.data.value?.miteneReceived"
      color="secondary"
      rounded="lg"
      class="d-flex align-center ga-2 mx-3 px-3 py-2 text-body-2"
    >
      <v-icon icon="mdi-eye" size="20" />
      <span>
        <b>{{ print.data.value.miteneReceived.fromMemberName ?? '（削除されたメンバー）' }}</b>
        から見てね → <b>見たよ</b> にしました
      </span>
    </v-sheet>

    <div class="detail__photos">
      <v-progress-circular v-if="print.isPending.value" indeterminate class="ma-auto" />
      <PhotoViewer
        v-else-if="print.data.value"
        :key="print.data.value.images.map((image) => image.id).join()"
        :image-ids="print.data.value.images.map((image) => image.id)"
      />
    </div>

    <!-- Sized like the tabs' bottom navigation. -->
    <div class="detail__actions">
      <v-btn
        variant="text"
        stacked
        rounded="0"
        prepend-icon="mdi-eye-outline"
        text="見てね"
        @click="miteneOpen = true"
      />
      <v-btn
        variant="text"
        stacked
        rounded="0"
        :prepend-icon="
          print.data.value?.responseStatus === 'done'
            ? 'mdi-check-circle-outline'
            : 'mdi-clipboard-clock-outline'
        "
        :class="{
          'opacity-50': print.data.value?.responseStatus === 'none',
          'response-todo': print.data.value?.responseStatus === 'todo',
        }"
        :text="
          print.data.value && print.data.value.responseStatus !== 'none'
            ? responseLabel(print.data.value.responseStatus)
            : '対応'
        "
        @click="responseOpen = true"
      />
      <v-btn
        variant="text"
        stacked
        rounded="0"
        prepend-icon="mdi-information-outline"
        text="情報"
        @click="infoOpen = true"
      />
    </div>
  </div>

  <template v-if="print.data.value">
    <MiteneSheet
      v-model="miteneOpen"
      :members="otherMembers"
      :sent="print.data.value.miteneSent"
      :loading="sendMitene.isPending.value"
      @send="send"
    />
    <ResponseStatusSheet
      v-model="responseOpen"
      :status="print.data.value.responseStatus"
      @select="setResponse"
    />
    <PrintInfoSheet
      v-model="infoOpen"
      :received-on="print.data.value.receivedOn"
      :due-on="print.data.value.dueOn"
      :topic-names="topicNames"
      :created-at="print.data.value.createdAt"
    />
    <MovePrintDialog
      v-model="moveOpen"
      :current="slotParam(print.data.value.childId)"
      :slots="slots"
      :loading="updatePrint.isPending.value"
      @move="move"
    />
  </template>
</template>

<style scoped>
.detail {
  display: flex;
  flex-direction: column;
  /* Below the app's bar (`App.vue`). */
  height: calc(100dvh - var(--v-layout-top, 0px));
}

.detail__photos {
  flex: 1;
  min-height: 0;
  display: flex;
}

.detail__photos > * {
  flex: 1;
}

.detail__actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  height: calc(56px + env(safe-area-inset-bottom));
  padding-bottom: env(safe-area-inset-bottom);
  font-size: 0.6875rem;
  background: rgba(0, 0, 0, 0.25);
}

.detail__actions .v-btn {
  height: 100%;
  font-size: inherit;
}

.detail__actions .v-btn :deep(.v-icon) {
  font-size: 1.5rem;
}

.response-todo {
  color: #fbd98a;
}
</style>
