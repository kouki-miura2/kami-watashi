<script setup lang="ts">
defineProps<{
  title: string
  /** The leading button: `back` (a pushed screen / previous step) or `close` (a modal flow). */
  icon?: 'back' | 'close'
}>()
defineEmits<{ navigate: [] }>()
</script>

<!-- App bar of a screen below the tabs: its title, a back/close button the parent handles, and optional actions. -->
<template>
  <v-app-bar flat color="background">
    <template v-if="icon" #prepend>
      <v-btn
        :icon="icon === 'back' ? 'mdi-arrow-left' : 'mdi-close'"
        :aria-label="icon === 'back' ? '戻る' : '閉じる'"
        @click="$emit('navigate')"
      />
    </template>
    <v-app-bar-title class="font-weight-bold">{{ title }}</v-app-bar-title>
    <template #append>
      <slot name="actions" />
    </template>
  </v-app-bar>
</template>
