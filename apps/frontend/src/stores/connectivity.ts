import { onlineManager } from '@tanstack/vue-query'
import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * Whether the browser is online, as TanStack Query's `onlineManager` sees it (the `online` /
 * `offline` events). While offline the app shows a banner and disables every operation
 * (`App.vue`), and TanStack Query holds requests until the connection is back.
 */
export const useConnectivityStore = defineStore('connectivity', () => {
  const online = ref(onlineManager.isOnline())
  onlineManager.subscribe((isOnline) => (online.value = isOnline))
  return { online }
})
