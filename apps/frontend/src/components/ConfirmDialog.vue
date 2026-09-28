<script setup lang="ts">
import { useConfirmStore } from '../stores/confirm.ts'

const confirm = useConfirmStore()
</script>

<template>
  <v-dialog
    :model-value="confirm.options !== null"
    max-width="400"
    @update:model-value="(open) => open || confirm.answer(false)"
  >
    <v-card v-if="confirm.options" :title="confirm.options.title" :text="confirm.options.text">
      <v-card-actions>
        <v-btn text="キャンセル" @click="confirm.answer(false)" />
        <v-btn
          :text="confirm.options.confirmText"
          :color="confirm.options.danger ? 'error' : 'primary'"
          @click="confirm.answer(true)"
        />
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
