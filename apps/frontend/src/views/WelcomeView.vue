<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { googleSignIn } from '../api/google-sign-in.ts'
import DisplayNameForm from '../components/DisplayNameForm.vue'
import StepLayout from '../components/StepLayout.vue'
import SubPageBar from '../components/SubPageBar.vue'
import TermsAgreement from '../components/TermsAgreement.vue'
import {
  type PendingRegistration,
  useDevLoginMutation,
  useGoogleLoginMutation,
  useRegisterOwnerMutation,
} from '../composables/useSignInMutations.ts'
import { useNotificationStore } from '../stores/notification.ts'

const router = useRouter()
const googleLogin = useGoogleLoginMutation()
const registerOwner = useRegisterOwnerMutation()
const devLogin = useDevLoginMutation()
const isDev = import.meta.env.DEV

/** Owner registration steps, after Google sign-in found no family: 1b terms → 1c name. */
const step = ref<'start' | 'terms' | 'name'>('start')
const registration = ref<PendingRegistration | null>(null)
const devAccount = ref({ googleSub: 'dev-owner-1', name: '一郎' })

const goHome = () => router.replace({ name: 'home' })

// Failures are reported app-wide (snackbar); only success moves on.
const signInWithGoogle = (idToken: string) =>
  googleLogin.mutate(idToken, {
    onSuccess: (outcome) => {
      if (outcome.status === 'signed-in') return goHome()
      if (outcome.status === 'not-registered') {
        registration.value = outcome.registration
        step.value = 'terms'
      }
    },
  })

const register = (name: string) => {
  if (!registration.value) return
  registerOwner.mutate({ idToken: registration.value.idToken, name }, { onSuccess: goHome })
}

const signInForDev = () => devLogin.mutate(devAccount.value, { onSuccess: goHome })

// Google's own button (only it hands out an ID token on the web), drawn again whenever this step
// is shown again.
const notification = useNotificationStore()
const googleButton = ref<HTMLElement>()
watch(googleButton, (element) => {
  if (!element) return
  googleSignIn
    .renderButton(element, signInWithGoogle)
    .catch(() => notification.show('Googleログインを読み込めませんでした'))
})
</script>

<template>
  <template v-if="step === 'terms'">
    <SubPageBar title="はじめる前に" icon="back" @navigate="step = 'start'" />
    <TermsAgreement @agree="step = 'name'" />
  </template>

  <template v-else-if="step === 'name' && registration">
    <SubPageBar title="あなたの呼び名" icon="back" @navigate="step = 'terms'" />
    <DisplayNameForm
      :initial-name="registration.suggestedName"
      submit-text="家族をつくる"
      :loading="registerOwner.isPending.value"
      @submit="register"
    />
  </template>

  <!-- 1a -->
  <StepLayout v-else centered>
    <div>
      <div class="text-caption font-weight-bold text-link">かみわたし</div>
      <h1 class="text-h4 font-weight-black">学校のプリントを、<br />家族みんなで。</h1>
    </div>
    <p class="text-body-2 text-medium-emphasis">
      写真に撮って、こどもごとに整理。<br />「見てね」で家族に声をかけられます。
    </p>
    <template #actions>
      <div
        v-if="googleSignIn.available"
        ref="googleButton"
        class="google-button"
        :class="{ 'google-button--pending': googleLogin.isPending.value }"
      />
      <v-btn
        v-else
        color="primary"
        prepend-icon="mdi-google"
        text="Googleでログイン"
        class="google-like"
        disabled
      />
      <div class="text-caption text-center text-medium-emphasis mb-6">
        家族を作る人（オーナー）はこちら
      </div>
      <v-btn
        variant="outlined"
        prepend-icon="mdi-qrcode-scan"
        text="招待QRコードで参加"
        class="google-like"
        :to="{ name: 'join' }"
      />

      <v-card v-if="isDev" title="開発用ログイン（オーナー）" class="mt-4">
        <v-card-text class="d-flex flex-column ga-2">
          <v-text-field v-model="devAccount.googleSub" label="googleSub" hide-details />
          <v-text-field v-model="devAccount.name" label="表示名" hide-details />
        </v-card-text>
        <v-card-actions>
          <v-btn text="ログイン" :loading="devLogin.isPending.value" @click="signInForDev" />
        </v-card-actions>
      </v-card>
    </template>
  </StepLayout>
</template>

<style scoped>
/* Google's button is at most 400px wide: centered in the wider layouts. */
.google-button {
  display: flex;
  justify-content: center;
  min-height: 44px;
}

.google-button--pending {
  pointer-events: none;
  opacity: 0.5;
}

/*
 * The other buttons are set like Google's (`size: large`, pill: 40px high, at most 400px wide,
 * 14px medium text centered, the icon at the left edge), so the pair reads as one set.
 */
.google-like {
  /* Not `block`: Vuetify's block buttons get `min-width: 100%`, which beats this `max-width`. */
  width: 100%;
  height: 40px;
  max-width: 400px;
  margin-inline: auto;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.25px;
}

.google-like :deep(.v-btn__prepend) {
  position: absolute;
  left: 12px;
}
</style>
