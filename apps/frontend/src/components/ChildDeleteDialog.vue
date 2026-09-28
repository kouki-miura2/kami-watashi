<script setup lang="ts">
import { ref, watch } from 'vue'

defineProps<{
  name: string
  printCount: number
  loading?: boolean
}>()
const open = defineModel<boolean>({ required: true })
defineEmits<{ delete: [] }>()

const typedName = ref('')
watch(open, (isOpen) => {
  if (isOpen) typedName.value = ''
})
</script>

<!-- 5c: the second confirmation of a child's deletion. Deleting stays disabled until the child's name is typed. -->
<template>
  <v-dialog v-model="open" max-width="400">
    <v-card>
      <v-card-text class="d-flex flex-column ga-3">
        <div class="text-caption font-weight-bold text-error">STEP 2 / 2</div>
        <div class="text-h6 font-weight-bold">本当に「{{ name }}」を削除しますか？</div>
        <p class="text-body-2 text-medium-emphasis">
          {{ name }}のプリント {{ printCount }}
          件と写真もすべて削除されます。確認のため、こどもの名前を入力してください。
        </p>
        <v-text-field
          v-model="typedName"
          label="こどもの名前"
          color="error"
          hide-details
          autofocus
        />
      </v-card-text>
      <v-card-actions>
        <v-btn text="キャンセル" @click="open = false" />
        <v-btn
          text="削除する"
          color="error"
          variant="flat"
          :loading
          :disabled="typedName.trim() !== name"
          @click="$emit('delete')"
        />
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
