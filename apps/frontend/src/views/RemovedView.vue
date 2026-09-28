<script setup lang="ts">
import StepLayout from '../components/StepLayout.vue'
</script>

<!-- 7b. Shown when this device's member key was rejected: the owner removed this member, or withdrew. -->
<template>
  <StepLayout centered>
    <v-icon icon="mdi-key-remove" size="40" color="medium-emphasis" />
    <h1 class="text-h5 font-weight-black">この家族から<br />外れました</h1>
    <p class="text-body-2 text-medium-emphasis">
      オーナーによる削除、または家族の退会により、この端末では利用できなくなりました。もう一度参加するには、オーナーに招待してもらってください。
    </p>
    <template #actions>
      <v-btn
        variant="outlined"
        size="x-large"
        block
        prepend-icon="mdi-qrcode-scan"
        text="招待QRコードで参加"
        :to="{ name: 'join' }"
      />
    </template>
  </StepLayout>
</template>
