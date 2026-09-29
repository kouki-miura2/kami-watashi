<script setup lang="ts">
import QRCode from 'qrcode'
import { LIMITS } from 'utils'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import { errorMessage } from '../api/errors.ts'
import StepLayout from '../components/StepLayout.vue'
import SubPageBar from '../components/SubPageBar.vue'
import { useBack } from '../composables/useBack.ts'
import { useCreateInviteMutation } from '../composables/useCreateInviteMutation.ts'
import { useMembersQuery } from '../composables/useMembers.ts'
import { formatCountdown } from '../lib/countdown.ts'
import { inviteUrl } from '../lib/invite.ts'

const close = useBack({ name: 'settings' })
const createInvite = useCreateInviteMutation()
// Polled while the QR code is up, so a member who just joined shows up here.
const members = useMembersQuery({ refetchInterval: 3_000 })
const isDev = import.meta.env.DEV

const now = ref(Date.now())
const timer = setInterval(() => (now.value = Date.now()), 1_000)
onUnmounted(() => clearInterval(timer))

const invite = computed(() => createInvite.data.value)
const expired = computed(() => invite.value !== undefined && invite.value.expiresAt <= now.value)
const seatsLeft = computed(() =>
  members.data.value ? LIMITS.familyMembers - members.data.value.length : null,
)

/**
 * The invite URL the QR code carries (spec "招待"): read in the app's join screen, or opened from
 * the phone's own camera, it lands on joining either way.
 */
const url = computed(() =>
  invite.value ? inviteUrl(location.origin, invite.value.inviteToken) : undefined,
)
const qrCode = ref<string>()
watch(url, async (next) => {
  qrCode.value = next ? await QRCode.toDataURL(next, { margin: 1, width: 480 }) : undefined
})

const recreate = () => createInvite.mutate()
onMounted(recreate)

// Development: open the URL in another browser (profile) to join without a phone.
const copyUrl = () => url.value && navigator.clipboard.writeText(url.value)
</script>

<!-- 5b: the owner shows this QR code to the person joining, in person. -->
<template>
  <SubPageBar title="メンバーを招待" icon="close" @navigate="close" />
  <StepLayout>
    <div class="d-flex flex-column align-center ga-5 pt-2 text-center">
      <v-alert
        v-if="createInvite.isError.value"
        type="error"
        variant="tonal"
        :text="errorMessage(createInvite.error.value)"
      />
      <template v-else>
        <p class="text-body-2 text-medium-emphasis">
          招待する人に、アプリの「招待QRコードで参加」<br />またはスマートフォンのカメラで読み取ってもらってください
        </p>
        <v-card width="240" height="240" class="d-flex align-center justify-center">
          <v-progress-circular v-if="!qrCode" indeterminate />
          <v-img v-else :src="qrCode" alt="招待QRコード" :class="{ expired }" />
        </v-card>
        <div v-if="invite">
          <div class="text-h4 font-weight-bold" :class="{ 'text-error': expired }">
            {{ expired ? '期限切れ' : formatCountdown(invite.expiresAt, now) }}
          </div>
          <div class="text-caption text-medium-emphasis">
            {{ expired ? '新しいQRコードを作ってください' : 'この時間内なら何人でも参加できます' }}
          </div>
        </div>
        <v-chip v-if="seatsLeft !== null" prepend-icon="mdi-account-multiple">
          あと {{ seatsLeft }} 人参加できます
        </v-chip>
        <v-btn
          v-if="isDev && invite"
          variant="text"
          size="small"
          prepend-icon="mdi-content-copy"
          text="招待URLをコピー（開発用）"
          @click="copyUrl"
        />
      </template>
    </div>
    <template #actions>
      <v-btn
        :variant="expired ? 'flat' : 'outlined'"
        :color="expired ? 'primary' : undefined"
        size="x-large"
        block
        prepend-icon="mdi-refresh"
        text="QRコードを作り直す"
        :loading="createInvite.isPending.value"
        @click="recreate"
      />
    </template>
  </StepLayout>
</template>

<style scoped>
.expired {
  opacity: 0.2;
}
</style>
