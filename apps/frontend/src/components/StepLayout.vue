<script setup lang="ts">
defineProps<{
  /** Centers the content vertically (welcome-style screens) instead of starting at the top. */
  centered?: boolean
}>()
</script>

<!--
  A full-height screen: content stacked from the top, the main action(s) pinned to the bottom.
  Grid, not flex: Vuetify's block buttons and inputs are flex-grow items, so in a flex column they
  would stretch to fill the free height.
-->
<template>
  <div class="step-layout px-6 pb-9">
    <div class="step-layout__body pt-2" :class="{ 'step-layout__body--centered': centered }">
      <slot />
    </div>
    <div class="step-layout__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.step-layout {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.step-layout__body {
  flex: 1;
  display: grid;
  align-content: start;
  gap: 16px;
  padding-bottom: 24px;
}

.step-layout__body--centered {
  align-content: center;
}

.step-layout__actions {
  display: grid;
  gap: 12px;
}
</style>
