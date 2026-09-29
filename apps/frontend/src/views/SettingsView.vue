<script setup lang="ts">
import { LIMITS, truncateChars } from 'utils'
import { computed, ref } from 'vue'

import { errorMessage } from '../api/errors.ts'
import NameDialog from '../components/NameDialog.vue'
import TabPage from '../components/TabPage.vue'
import TypeToConfirmDialog from '../components/TypeToConfirmDialog.vue'
import { useChildrenQuery } from '../composables/useChildren.ts'
import {
  useLeaveFamilyMutation,
  useMembersQuery,
  useRemoveMemberMutation,
  useRenameMeMutation,
} from '../composables/useMembers.ts'
import { useStatsQuery } from '../composables/useStatsQuery.ts'
import { useTopicsQuery } from '../composables/useTopics.ts'
import { formatMegabytes } from '../lib/format.ts'
import { useAuthStore } from '../stores/auth.ts'
import { useConfirmStore } from '../stores/confirm.ts'
import { termsLinks } from '../terms.ts'

const auth = useAuthStore()
const confirm = useConfirmStore()
const members = useMembersQuery()
const children = useChildrenQuery()
const topics = useTopicsQuery()
const stats = useStatsQuery()
const renameMe = useRenameMeMutation()
const removeMember = useRemoveMemberMutation()
const leaveFamily = useLeaveFamilyMutation()

const familyFull = computed(() => (members.data.value?.length ?? 0) >= LIMITS.familyMembers)
const childCount = computed(() => children.data.value?.filter((slot) => slot.id !== null).length)
const storage = computed(() => stats.data.value?.storage)
const me = computed(() => members.data.value?.find((member) => member.isMe))

// Your own display name (history keeps the old one where it was recorded).
const renameOpen = ref(false)
const renameError = ref<string>()
const openRename = () => {
  renameError.value = undefined
  renameOpen.value = true
}
const rename = (name: string) =>
  renameMe.mutate(name, {
    onSuccess: () => (renameOpen.value = false),
    onError: (error) => (renameError.value = errorMessage(error)),
  })

const remove = async (member: { id: string; name: string }) => {
  const confirmed = await confirm.confirm({
    title: `${member.name}さんをメンバーから削除しますか？`,
    text: 'この人の端末では使えなくなります。もう一度参加するには、新しく招待してください。',
    confirmText: '削除する',
    danger: true,
  })
  if (confirmed) removeMember.mutate(member.id)
}

/** The owner's withdrawal, past the first confirmation, awaiting 「退会する」 typed (spec). */
const withdrawOpen = ref(false)

// The owner withdraws (deleting the whole family's data, so confirmed twice: a dialog, then typing
// 「退会する」); an invited member just leaves.
const leave = async () => {
  const confirmed = await confirm.confirm(
    auth.isOwner
      ? {
          title: '退会しますか？',
          text: 'こども・プリント・写真・履歴など、家族のデータをすべて削除します。招待したメンバーも使えなくなります。元に戻せません。',
          confirmText: 'つぎへ',
          danger: true,
        }
      : {
          title: 'この家族から抜けますか？',
          text: 'この端末では使えなくなります。もう一度参加するには、オーナーに招待してもらってください。',
          confirmText: '抜ける',
          danger: true,
        },
  )
  if (!confirmed) return
  if (auth.isOwner) withdrawOpen.value = true
  else leaveFamily.mutate()
}
</script>

<!-- 5a -->
<template>
  <TabPage title="設定">
    <div class="d-flex flex-column ga-4">
      <section>
        <div
          class="d-flex justify-space-between text-caption font-weight-bold text-medium-emphasis px-1 pb-2"
        >
          <span>家族のメンバー</span>
          <span v-if="members.data.value"
            >{{ members.data.value.length }}/{{ LIMITS.familyMembers }}</span
          >
        </div>
        <v-card>
          <v-list>
            <v-list-item v-for="member in members.data.value" :key="member.id" :title="member.name">
              <template #prepend>
                <v-avatar :color="member.isMe ? 'primary' : 'surface-light'" size="34">
                  {{ truncateChars(member.name, 1) }}
                </v-avatar>
              </template>
              <template #subtitle>
                {{
                  [member.isMe && 'あなた', member.isOwner && 'オーナー'].filter(Boolean).join('・')
                }}
              </template>
              <template #append>
                <v-btn
                  v-if="member.isMe"
                  icon="mdi-pencil-outline"
                  variant="text"
                  size="small"
                  aria-label="表示名を変更"
                  @click="openRename"
                />
                <v-btn
                  v-else-if="auth.isOwner"
                  icon="mdi-account-remove-outline"
                  variant="text"
                  size="small"
                  :aria-label="`${member.name}さんを削除`"
                  @click="remove(member)"
                />
              </template>
            </v-list-item>
            <template v-if="auth.isOwner">
              <v-divider />
              <v-list-item
                title="メンバーを招待"
                :subtitle="familyFull ? `メンバーは最大${LIMITS.familyMembers}人です` : undefined"
                prepend-icon="mdi-qrcode"
                base-color="link"
                :disabled="familyFull"
                :to="{ name: 'invite' }"
              />
            </template>
          </v-list>
        </v-card>
      </section>

      <v-card>
        <v-list>
          <v-list-item
            title="こども"
            prepend-icon="mdi-baby-face-outline"
            :to="{ name: 'children' }"
          >
            <template #append>
              <span v-if="childCount !== undefined" class="text-body-2 text-medium-emphasis mr-2">
                {{ childCount }}人
              </span>
              <v-icon icon="mdi-chevron-right" />
            </template>
          </v-list-item>
          <v-divider />
          <v-list-item title="トピック" prepend-icon="mdi-tag-outline" :to="{ name: 'topics' }">
            <template #append>
              <span v-if="topics.data.value" class="text-body-2 text-medium-emphasis mr-2">
                {{ topics.data.value.length }}件
              </span>
              <v-icon icon="mdi-chevron-right" />
            </template>
          </v-list-item>
        </v-list>
      </v-card>

      <v-card v-if="storage" class="pa-4 d-flex flex-column ga-2">
        <div class="d-flex justify-space-between align-baseline">
          <span>容量</span>
          <span class="text-caption">
            <span class="text-body-1 font-weight-bold">{{
              formatMegabytes(storage.usedBytes)
            }}</span>
            / {{ formatMegabytes(storage.limitBytes) }} MB
          </span>
        </div>
        <v-progress-linear
          :model-value="(storage.usedBytes / storage.limitBytes) * 100"
          color="primary"
          bg-color="surface-light"
          rounded
          height="8"
        />
        <v-btn
          variant="text"
          color="link"
          prepend-icon="mdi-delete-clock-outline"
          text="古いプリントを一括削除"
          class="align-self-start px-0"
          :to="{ name: 'bulk-delete' }"
        />
      </v-card>

      <v-card>
        <v-list>
          <v-list-item
            title="ヘルプ"
            :href="termsLinks.help"
            :disabled="!termsLinks.help"
            target="_blank"
            append-icon="mdi-open-in-new"
          />
          <v-divider />
          <v-list-item
            title="利用規約"
            :href="termsLinks.terms"
            :disabled="!termsLinks.terms"
            target="_blank"
            append-icon="mdi-open-in-new"
          />
          <v-divider />
          <v-list-item
            title="プライバシーポリシー"
            :href="termsLinks.privacy"
            :disabled="!termsLinks.privacy"
            target="_blank"
            append-icon="mdi-open-in-new"
          />
          <v-divider />
          <v-list-item
            :title="
              auth.isOwner ? '退会する（家族のデータをすべて削除）' : 'この家族から抜ける（脱退）'
            "
            base-color="error"
            :disabled="leaveFamily.isPending.value"
            @click="leave"
          />
        </v-list>
      </v-card>
    </div>
  </TabPage>

  <NameDialog
    v-model="renameOpen"
    title="表示名を変更"
    label="表示名"
    submit-text="変更する"
    :initial-name="me?.name"
    :loading="renameMe.isPending.value"
    :error="renameError"
    @submit="rename"
  />
  <TypeToConfirmDialog
    v-model="withdrawOpen"
    title="本当に退会しますか？"
    text="家族のデータはすべて削除され、元に戻せません。確認のため「退会する」と入力してください。"
    label="「退会する」と入力"
    expected="退会する"
    confirm-text="退会する"
    :loading="leaveFamily.isPending.value"
    @confirm="leaveFamily.mutate()"
  />
</template>
