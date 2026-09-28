<script setup lang="ts">
import { ref } from 'vue'
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
const signInWithGoogle = () =>
  googleLogin.mutate(undefined, {
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
      <div class="text-caption font-weight-bold text-link">KAMI-WATASHI</div>
      <h1 class="text-h4 font-weight-black">学校のプリントを、<br />家族みんなで。</h1>
    </div>
    <p class="text-body-2 text-medium-emphasis">
      写真に撮って、こどもごとに整理。<br />「見てね」で家族に声をかけられます。
    </p>
    <template #actions>
      <v-btn
        color="primary"
        size="x-large"
        block
        prepend-icon="mdi-google"
        text="Googleでログイン"
        :disabled="!googleSignIn.available"
        :loading="googleLogin.isPending.value"
        @click="signInWithGoogle"
      />
      <div class="text-caption text-center text-medium-emphasis">
        家族を作る人（オーナー）はこちら
      </div>
      <v-btn
        variant="outlined"
        size="x-large"
        block
        prepend-icon="mdi-qrcode-scan"
        text="招待QRコードで参加"
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
