<script setup lang="ts">
import { ref, watch } from 'vue'

defineProps<{
  title: string
  text: string
  /** The field's label, naming what to type. */
  label: string
  /** What must be typed before the action is enabled. */
  expected: string
  confirmText: string
  loading?: boolean
}>()
const open = defineModel<boolean>({ required: true })
defineEmits<{ confirm: [] }>()

const typed = ref('')
watch(open, (isOpen) => {
  if (isOpen) typed.value = ''
})
</script>

<!--
  The second confirmation of an action that can't be undone and takes a lot of data with it (5c:
  deleting a child; the owner's withdrawal). The action stays disabled until `expected` is typed.
-->
<template>
  <v-dialog v-model="open" max-width="400">
    <v-card>
      <v-card-text class="d-flex flex-column ga-3">
        <div class="text-caption font-weight-bold text-error">STEP 2 / 2</div>
        <div class="text-h6 font-weight-bold">{{ title }}</div>
        <p class="text-body-2 text-medium-emphasis">{{ text }}</p>
        <v-text-field v-model="typed" :label color="error" hide-details autofocus />
      </v-card-text>
      <v-card-actions>
        <v-btn text="キャンセル" @click="open = false" />
        <v-btn
          :text="confirmText"
          color="error"
          variant="flat"
          :loading
          :disabled="typed.trim() !== expected"
          @click="$emit('confirm')"
        />
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
