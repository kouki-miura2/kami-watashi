<script setup lang="ts">
import { LIMITS } from 'utils'
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import StepLayout from './StepLayout.vue'

defineProps<{ loading?: boolean }>()
defineEmits<{ agree: [] }>()

const agreed = ref(false)

// In a new tab: leaving this screen would lose the step in progress (the Google sign-in, the invite).
const router = useRouter()
const legalHref = (kind: 'terms' | 'privacy') =>
  router.resolve({ name: 'legal', params: { kind } }).href
</script>

<!-- Agreement to the terms of use and privacy policy (design 1b): on registration, on joining, and after a revision. -->
<template>
  <StepLayout>
    <p class="text-body-2 text-medium-emphasis">ご利用には以下への同意が必要です。</p>
    <v-card>
      <v-list>
        <v-list-item
          title="利用規約"
          :href="legalHref('terms')"
          target="_blank"
          append-icon="mdi-open-in-new"
        />
        <v-divider />
        <v-list-item
          title="プライバシーポリシー"
          :href="legalHref('privacy')"
          target="_blank"
          append-icon="mdi-open-in-new"
        />
      </v-list>
    </v-card>
    <v-alert color="secondary" variant="tonal" icon="mdi-information-outline" class="text-body-2">
      ・Googleアカウントを失うと家族のデータは使えなくなります<br />
      ・{{ LIMITS.autoDeleteDays }}日だれもアプリを開かないと、データは自動で削除されます
    </v-alert>
    <v-checkbox v-model="agreed" label="内容を確認し、同意します" hide-details />
    <template #actions>
      <v-btn
        color="secondary"
        size="x-large"
        block
        text="同意してはじめる"
        :disabled="!agreed"
        :loading
        @click="$emit('agree')"
      />
    </template>
  </StepLayout>
</template>
