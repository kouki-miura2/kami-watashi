<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  /** The other members (you can't send mitene to yourself). */
  members: { id: string; name: string }[]
  /** Mitene you already sent on this print, by recipient. */
  sent: { memberId: string; status: 'requested' | 'seen' }[]
  loading?: boolean
}>()
const open = defineModel<boolean>({ required: true })
defineEmits<{ send: [memberIds: string[]] }>()

const selected = ref<string[]>([])
watch(open, (isOpen) => {
  if (isOpen) selected.value = []
})

const statusOf = (memberId: string) =>
  props.sent.find((mitene) => mitene.memberId === memberId)?.status
</script>

<!-- 3b: ask members to look at this print; also where you see whether they did (見たよ). -->
<template>
  <v-bottom-sheet v-model="open">
    <v-card class="pb-4">
      <v-card-item>
        <v-card-title class="font-weight-bold">見てね</v-card-title>
        <v-card-subtitle>このプリントを見てほしい人を選んでください</v-card-subtitle>
      </v-card-item>
      <v-card-text class="d-flex flex-column ga-3">
        <p v-if="members.length === 0" class="text-body-2 text-medium-emphasis">
          ほかのメンバーがいません。設定からメンバーを招待できます。
        </p>
        <v-card v-else>
          <v-list>
            <v-list-item v-for="member in members" :key="member.id" :title="member.name">
              <template #prepend>
                <v-checkbox-btn v-model="selected" :value="member.id" :aria-label="member.name" />
              </template>
              <template #append>
                <v-chip
                  v-if="statusOf(member.id)"
                  size="x-small"
                  variant="flat"
                  label
                  :color="statusOf(member.id) === 'requested' ? 'secondary' : 'done'"
                  :text="statusOf(member.id) === 'requested' ? '見てね' : '見たよ'"
                />
                <span v-else class="text-caption text-disabled">—</span>
              </template>
            </v-list-item>
          </v-list>
        </v-card>
        <p class="text-caption text-medium-emphasis">
          すでに見てねがある人に送ると、送信者があなたに変わり「見てね」に戻ります。
        </p>
        <v-btn
          color="secondary"
          size="large"
          block
          prepend-icon="mdi-send"
          text="見てねを送る"
          :disabled="selected.length === 0"
          :loading
          @click="$emit('send', selected)"
        />
      </v-card-text>
    </v-card>
  </v-bottom-sheet>
</template>
