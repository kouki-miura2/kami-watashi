<script setup lang="ts">
defineProps<{
  items: {
    id: string
    name: string
    /** Shown at the end of the row (e.g. a count). */
    note?: string
  }[]
  icon: string
}>()
defineEmits<{ rename: [id: string]; delete: [id: string] }>()
</script>

<!-- The list of children or topics in their management screens (5e): each row renames or deletes through its ⋯ menu. -->
<template>
  <v-card>
    <v-list>
      <template v-for="(item, index) in items" :key="item.id">
        <v-divider v-if="index > 0" />
        <v-list-item :title="item.name" :prepend-icon="icon">
          <template #append>
            <span v-if="item.note" class="text-caption text-medium-emphasis mr-1">{{
              item.note
            }}</span>
            <v-menu>
              <template #activator="{ props: menu }">
                <v-btn
                  v-bind="menu"
                  icon="mdi-dots-horizontal"
                  variant="text"
                  size="small"
                  :aria-label="`${item.name}の操作`"
                />
              </template>
              <v-list>
                <v-list-item
                  title="名前を変更"
                  prepend-icon="mdi-pencil-outline"
                  @click="$emit('rename', item.id)"
                />
                <v-list-item
                  title="削除"
                  prepend-icon="mdi-delete-outline"
                  base-color="error"
                  @click="$emit('delete', item.id)"
                />
              </v-list>
            </v-menu>
          </template>
        </v-list-item>
      </template>
    </v-list>
  </v-card>
</template>
