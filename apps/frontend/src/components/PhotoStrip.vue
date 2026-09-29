<script setup lang="ts">
defineProps<{
  photos: { url: string; rotating?: boolean }[]
  /** How many more can be added; the add tile hides at 0. */
  photosLeft: number
  loading?: boolean
}>()
defineEmits<{ add: []; rotate: [index: number]; remove: [index: number] }>()
</script>

<!-- New photos in page order, numbered, each rotatable and removable, with a tile to add more (4a). -->
<template>
  <div class="d-flex flex-wrap ga-2">
    <div v-for="(photo, index) in photos" :key="photo.url" class="photo">
      <v-img :src="photo.url" cover width="72" height="92" rounded="lg" />
      <span class="photo__page">{{ index + 1 }}</span>
      <v-btn
        class="photo__remove"
        icon="mdi-close"
        size="x-small"
        :aria-label="`${index + 1}ページ目を外す`"
        @click="$emit('remove', index)"
      />
      <v-btn
        class="photo__rotate"
        icon="mdi-rotate-right"
        size="x-small"
        :loading="photo.rotating"
        :aria-label="`${index + 1}ページ目を右に90°回転`"
        @click="$emit('rotate', index)"
      />
    </div>
    <v-btn
      v-if="photosLeft > 0"
      class="photo-add"
      variant="outlined"
      rounded="lg"
      width="72"
      height="92"
      :loading
      @click="$emit('add')"
    >
      <div class="d-flex flex-column align-center ga-1">
        <v-icon icon="mdi-camera-plus-outline" />
        <span class="text-caption">追加</span>
      </div>
    </v-btn>
  </div>
</template>

<style scoped>
.photo {
  position: relative;
}

.photo__page {
  position: absolute;
  left: 4px;
  top: 4px;
  padding: 0 5px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 700;
  color: rgb(var(--v-theme-on-primary));
  background: rgb(var(--v-theme-primary));
}

.photo__remove {
  position: absolute;
  right: -6px;
  top: -6px;
}

.photo__rotate {
  position: absolute;
  right: -6px;
  bottom: -6px;
}

.photo-add {
  border-style: dashed;
}
</style>
