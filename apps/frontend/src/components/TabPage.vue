<script setup lang="ts">
defineProps<{
  title: string
  /** Shown at the end of the title's line (the home screen's date). */
  note?: string
}>()
</script>

<!--
  Top-level page of a bottom navigation tab: a title over the page content. The title stays put
  and only the content scrolls, between it and the bottom navigation.
-->
<template>
  <div class="tab-page">
    <div class="d-flex align-baseline ga-2 px-6 pt-3 pb-2">
      <h1 class="tab-page__title font-weight-black">{{ title }}</h1>
      <v-spacer />
      <span v-if="note" class="text-body-2 text-medium-emphasis">{{ note }}</span>
    </div>
    <div class="tab-page__content px-4 pb-4">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.tab-page {
  display: flex;
  flex-direction: column;
  /* `v-main` sets the layout variables: the room left by the bottom navigation. */
  height: calc(100dvh - var(--v-layout-top, 0px) - var(--v-layout-bottom, 0px));
}

.tab-page__title {
  font-size: 1.5rem;
  line-height: 1.3;
}

.tab-page__content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
</style>
