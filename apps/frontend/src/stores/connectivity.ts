import { Network } from '@capacitor/network'
import { onlineManager } from '@tanstack/vue-query'
import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * Whether the device is online. While offline the app shows a banner and disables every
 * operation (`App.vue`), and TanStack Query holds requests until the connection is back.
 */
export const useConnectivityStore = defineStore('connectivity', () => {
  const online = ref(true)

  const update = (connected: boolean) => {
    online.value = connected
    onlineManager.setOnline(connected)
  }

  /** Starts following the device's network status. Call once at startup. */
  const start = async () => {
    await Network.addListener('networkStatusChange', (status) => update(status.connected))
    update((await Network.getStatus()).connected)
  }

  return { online, start }
})
