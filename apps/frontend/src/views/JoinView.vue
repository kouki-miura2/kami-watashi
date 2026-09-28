<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { ApiError, errorMessage } from '../api/errors.ts'
import DisplayNameForm from '../components/DisplayNameForm.vue'
import StepLayout from '../components/StepLayout.vue'
import SubPageBar from '../components/SubPageBar.vue'
import TermsAgreement from '../components/TermsAgreement.vue'
import { useRedeemInviteMutation } from '../composables/useSignInMutations.ts'
import { qrScanner } from '../device/qr-scanner.ts'

const router = useRouter()
const redeem = useRedeemInviteMutation()

/** Joining a family: 1d invite QR code → 1b terms → 1c name → this device's member key is saved. */
const step = ref<'code' | 'terms' | 'name'>('code')
const inviteToken = ref('')
/** Why the invite code was not accepted (expired, family full, ...), shown on the code step. */
const codeError = ref<string>()
const nameError = ref<string>()

// On the device the camera opens right away (the invite is always in person); pasting the code
// stays as the fallback, and is the only way in the browser.
const canScan = qrScanner.available
const scanning = ref(false)
const scan = async () => {
  scanning.value = true
  codeError.value = undefined
  try {
    const scanned = await qrScanner.scan()
    if (!scanned) return
    inviteToken.value = scanned
    step.value = 'terms'
  } catch {
    codeError.value = 'QRコードを読み取れませんでした。招待コードを貼り付けてください'
  } finally {
    scanning.value = false
  }
}
onMounted(() => {
  if (canScan) void scan()
})

const join = async (name: string) => {
  nameError.value = undefined
  try {
    await redeem.mutateAsync({ inviteToken: inviteToken.value.trim(), name })
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
    <v-form class="fill-height" @submit.prevent="inviteToken.trim() && (step = 'terms')">
      <StepLayout>
        <v-alert v-if="codeError" type="error" variant="tonal" :text="codeError" />
        <template v-if="canScan">
          <p class="text-body-2 text-medium-emphasis">
            オーナーの画面に表示されたQRコードを読み取ってください。
          </p>
          <v-btn
            color="primary"
            size="x-large"
            block
            prepend-icon="mdi-qrcode-scan"
            text="カメラで読み取る"
            :loading="scanning"
            @click="scan"
          />
          <p class="text-caption text-medium-emphasis mt-4">
            読み取れないときは、招待コードを貼り付けてください。
          </p>
        </template>
        <p v-else class="text-body-2 text-medium-emphasis">
          オーナーの画面に表示された招待コードを貼り付けてください。
        </p>
        <v-textarea
          v-model="inviteToken"
          label="招待コード"
          rows="3"
          auto-grow
          hide-details
          @update:model-value="codeError = undefined"
        />
        <template #actions>
          <v-btn
            type="submit"
            :color="canScan ? undefined : 'primary'"
            :variant="canScan ? 'outlined' : 'flat'"
            size="x-large"
            block
            text="つぎへ"
            :disabled="!inviteToken.trim()"
          />
        </template>
      </StepLayout>
    </v-form>
  </template>
</template>
