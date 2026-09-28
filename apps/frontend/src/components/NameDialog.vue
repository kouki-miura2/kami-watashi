<script setup lang="ts">
import { charLength, LIMITS } from 'utils'
import { computed, ref, watch } from 'vue'

import { nameRules } from '../lib/validation.ts'

const props = defineProps<{
  title: string
  label: string
  submitText: string
  /** The name to start from (renaming); empty when adding. */
  initialName?: string
  loading?: boolean
  /** Why the submitted name was rejected (e.g. taken). Shown until the name is edited. */
  error?: string
}>()
const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ submit: [name: string] }>()

const name = ref('')
const valid = ref<boolean | null>(null)
const submittedName = ref<string>()

watch(open, (isOpen) => {
  if (!isOpen) return
  name.value = props.initialName ?? ''
  submittedName.value = undefined
})

// Only while the field still holds the rejected name: an error message makes the form invalid,
// so keeping it after an edit would leave the submit button disabled for good.
const shownError = computed(() =>
  name.value.trim() === submittedName.value ? props.error : undefined,
)

const submit = () => {
  if (!valid.value) return
  submittedName.value = name.value.trim()
  emit('submit', submittedName.value)
}
</script>

<!-- Adding or renaming a child or topic: one name field, checked like the API checks it. -->
<template>
  <v-dialog v-model="open" max-width="400">
    <v-form v-model="valid" @submit.prevent="submit">
      <v-card :title="title">
        <v-card-text>
          <v-text-field
            v-model="name"
            :label="label"
            :rules="nameRules"
            :counter="LIMITS.nameMaxLength"
            :counter-value="(value: string) => charLength(value.trim())"
            :error-messages="shownError"
            autofocus
          />
        </v-card-text>
        <v-card-actions>
          <v-btn text="キャンセル" @click="open = false" />
          <v-btn type="submit" color="primary" :text="submitText" :loading :disabled="!valid" />
        </v-card-actions>
      </v-card>
    </v-form>
  </v-dialog>
</template>
