<script setup lang="ts">
import { useRouter } from 'vue-router'

import SubPageBar from '../components/SubPageBar.vue'
import TermsAgreement from '../components/TermsAgreement.vue'
import { useAgreeTermsMutation } from '../composables/useAgreeTermsMutation.ts'

const router = useRouter()
const agreeTerms = useAgreeTermsMutation()

const agree = () =>
  agreeTerms.mutate(undefined, { onSuccess: () => router.replace({ name: 'home' }) })
</script>

<!-- Agreeing again after the terms were revised: `/launch` or any request (`terms_required`) sends members here. -->
<template>
  <SubPageBar title="規約が改定されました" />
  <TermsAgreement :loading="agreeTerms.isPending.value" @agree="agree" />
</template>
