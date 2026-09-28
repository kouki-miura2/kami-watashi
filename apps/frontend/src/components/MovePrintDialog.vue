<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  /** Where the print is now (`slotParam`). */
  current: string
  slots: { param: string; name: string }[]
  loading?: boolean
}>()
const open = defineModel<boolean>({ required: true })
defineEmits<{ move: [slot: string] }>()

const target = ref<string>()
watch(open, (isOpen) => {
  if (isOpen) target.value = undefined
})
</script>

<!-- 4c: moving a print to another child (or the family-common slot) after registering it in the wrong place. -->
<template>
  <v-dialog v-model="open" max-width="400">
    <v-card title="こどもを付け替え">
      <v-card-text class="d-flex flex-column ga-2">
        <v-radio-group v-model="target" hide-details>
          <v-radio
            v-for="slot in props.slots"
            :key="slot.param"
            :value="slot.param"
            :label="slot.name"
            :disabled="slot.param === current"
          />
        </v-radio-group>
        <p class="text-caption text-medium-emphasis">
          付け替え先のこどもで新しい番号になります（写真・既読・見てねはそのまま）。
        </p>
      </v-card-text>
      <v-card-actions>
        <v-btn text="キャンセル" @click="open = false" />
        <v-btn
          color="primary"
          text="付け替える"
          :disabled="!target"
          :loading
          @click="target && $emit('move', target)"
        />
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
