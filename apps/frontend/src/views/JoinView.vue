<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { ApiError, errorMessage } from '../api/errors.ts'
import DisplayNameForm from '../components/DisplayNameForm.vue'
import QrScanner from '../components/QrScanner.vue'
import StepLayout from '../components/StepLayout.vue'
import SubPageBar from '../components/SubPageBar.vue'
import TermsAgreement from '../components/TermsAgreement.vue'
import { useRedeemInviteMutation } from '../composables/useSignInMutations.ts'
import { inviteTokenFromQuery, inviteTokenFromScan } from '../lib/invite.ts'

const route = useRoute()
const router = useRouter()
const redeem = useRedeemInviteMutation()

/**
 * The invite token: from the invite URL when it was opened directly (the phone's own camera read
 * the owner's QR code), or read here by the app's scanner (1d). Taken out of the address bar right
 * away, so it isn't left in the history.
 */
const inviteToken = ref(inviteTokenFromQuery(route.query))
if (inviteToken.value) void router.replace({ name: 'join' })

/** Joining a family: invite QR code → 1b terms → 1c name → the API keeps this browser's member key. */
const step = ref<'code' | 'terms' | 'name'>(inviteToken.value ? 'terms' : 'code')
/** Why the invite was not accepted (expired, family full, ...), shown on the first step. */
const codeError = ref<string>()
const nameError = ref<string>()

/** A QR code that isn't an invite (another app's), while scanning. */
const scanHint = ref<string>()
const cameraFailed = ref(false)

const onScan = (text: string) => {
  const token = inviteTokenFromScan(text, location.origin)
  if (!token) {
    scanHint.value = '招待QRコードではありません。オーナーの画面の招待QRコードを写してください'
    return
  }
  inviteToken.value = token
  codeError.value = undefined
  scanHint.value = undefined
  step.value = 'terms'
}

const join = async (name: string) => {
  if (!inviteToken.value) return
  nameError.value = undefined
  try {
    await redeem.mutateAsync({ inviteToken: inviteToken.value, name })
  } catch (error) {
    if (error instanceof ApiError && error.code === 'name_taken') {
      nameError.value = errorMessage(error)
    } else {
      codeError.value = errorMessage(error)
      step.value = 'code'
    }
    return
  }
  await router.replace({ name: 'home' })
}
</script>

<template>
  <template v-if="step === 'terms'">
    <SubPageBar title="はじめる前に" icon="back" @navigate="step = 'code'" />
    <TermsAgreement @agree="step = 'name'" />
  </template>

  <template v-else-if="step === 'name'">
    <SubPageBar title="あなたの呼び名" icon="back" @navigate="step = 'terms'" />
    <DisplayNameForm
      submit-text="参加する"
      :loading="redeem.isPending.value"
      :error="nameError"
      @submit="join"
    />
  </template>

  <!-- 1d -->
  <template v-else>
    <SubPageBar
      title="招待QRを読み取る"
      icon="close"
      @navigate="router.replace({ name: 'welcome' })"
    />
    <StepLayout>
      <v-alert v-if="codeError" type="error" variant="tonal" :text="codeError" />
      <p class="text-body-2 text-medium-emphasis text-center">
        オーナーの画面に表示された招待QRコードを、<br />枠の中に写してください。
      </p>
      <template v-if="!cameraFailed">
        <QrScanner @detect="onScan" @error="cameraFailed = true" />
        <p v-if="scanHint" class="text-caption text-error text-center">{{ scanHint }}</p>
      </template>
      <template v-else>
        <v-alert
          type="warning"
          variant="tonal"
          text="カメラを使えませんでした。ブラウザでカメラの使用を許可してから、もう一度お試しください。"
        />
        <v-btn
          variant="outlined"
          block
          prepend-icon="mdi-camera-outline"
          text="もう一度カメラを開く"
          @click="cameraFailed = false"
        />
      </template>
    </StepLayout>
  </template>
</template>
