<script setup lang="ts">
defineProps<{
  title: string
  /** A small line above the title (the home screen's date). */
  overline?: string
}>()
</script>

<!-- Top-level page of a bottom navigation tab: a large title over the page content. -->
<template>
  <div class="px-4 pb-4">
    <div class="px-2 pt-3 pb-2">
      <div v-if="overline" class="text-caption text-medium-emphasis">{{ overline }}</div>
      <h1 class="text-h5 font-weight-black">{{ title }}</h1>
    </div>
    <slot />
  </div>
</template>
