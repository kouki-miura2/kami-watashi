<script setup lang="ts">
import { charLength, LIMITS } from 'utils'
import { computed, ref } from 'vue'

import { nameRules } from '../lib/validation.ts'
import StepLayout from './StepLayout.vue'

const props = defineProps<{
  initialName?: string
  submitText: string
  loading?: boolean
  /** Why the submitted name was rejected (e.g. taken). Shown until the name is edited. */
  error?: string
}>()
const emit = defineEmits<{ submit: [name: string] }>()

const name = ref(props.initialName ?? '')
const valid = ref<boolean | null>(null)
const submittedName = ref<string>()

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

<!-- Entering one's own display name (design 1c): on registration and on joining. -->
<template>
  <v-form v-model="valid" class="fill-height" @submit.prevent="submit">
    <StepLayout>
      <p class="text-body-2 text-medium-emphasis">「見てね」の宛先や履歴に表示されます。</p>
      <v-text-field
        v-model="name"
        label="表示名"
        :rules="nameRules"
        :counter="LIMITS.nameMaxLength"
        :counter-value="(value: string) => charLength(value.trim())"
        hint="家族の中で同じ名前は使えません"
        persistent-hint
        :error-messages="shownError"
        autofocus
      />
      <template #actions>
        <v-btn
          type="submit"
          color="primary"
          size="x-large"
          block
          :text="submitText"
          :loading
          :disabled="!valid"
        />
      </template>
    </StepLayout>
  </v-form>
</template>
