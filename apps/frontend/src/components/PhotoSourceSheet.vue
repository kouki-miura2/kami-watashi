<script setup lang="ts">
import { LIMITS } from 'utils'

const open = defineModel<boolean>({ required: true })
defineEmits<{ take: []; choose: [] }>()
</script>

<!-- 4b: where the photos come from. Also used when retaking every page. -->
<template>
  <v-bottom-sheet v-model="open">
    <v-card title="写真を追加" class="pb-4">
      <v-card-text class="d-flex flex-column ga-3">
        <div class="d-flex ga-3">
          <v-card
            color="primary"
            class="flex-1-1 pa-5 d-flex flex-column ga-2"
            @click="$emit('take')"
          >
            <v-icon icon="mdi-camera-outline" size="30" />
            <span class="font-weight-bold">カメラで撮影</span>
          </v-card>
          <v-card class="flex-1-1 pa-5 d-flex flex-column ga-2" @click="$emit('choose')">
            <v-icon icon="mdi-image-multiple-outline" size="30" />
            <span class="font-weight-bold">写真から選ぶ</span>
          </v-card>
        </div>
        <p class="text-caption text-medium-emphasis">
          複数ページは続けて追加できます（最大{{
            LIMITS.printImages
          }}枚）。位置情報などは削除して保存します。
        </p>
      </v-card-text>
    </v-card>
  </v-bottom-sheet>
</template>
