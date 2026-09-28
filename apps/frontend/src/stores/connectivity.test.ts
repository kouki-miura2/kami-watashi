import type { ConnectionStatusChangeListener } from '@capacitor/network'
import { onlineManager } from '@tanstack/vue-query'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, expect, test, vi } from 'vite-plus/test'

import { useConnectivityStore } from './connectivity.ts'

const network = vi.hoisted(() => ({ getStatus: vi.fn(), addListener: vi.fn() }))
vi.mock('@capacitor/network', () => ({ Network: network }))

const status = (connected: boolean) => ({
  connected,
  connectionType: connected ? ('wifi' as const) : ('none' as const),
})

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  onlineManager.setOnline(true)
})

test('start takes the current network status', async () => {
  network.getStatus.mockResolvedValue(status(false))
  const connectivity = useConnectivityStore()

  await connectivity.start()

  expect(connectivity.online).toBe(false)
  expect(onlineManager.isOnline()).toBe(false)
})

test('follows network status changes', async () => {
  network.getStatus.mockResolvedValue(status(true))
  const connectivity = useConnectivityStore()
  await connectivity.start()
  const listener = network.addListener.mock.calls[0]?.[1] as ConnectionStatusChangeListener

  listener(status(false))
  expect(connectivity.online).toBe(false)
  expect(onlineManager.isOnline()).toBe(false)

  listener(status(true))
  expect(connectivity.online).toBe(true)
  expect(onlineManager.isOnline()).toBe(true)
})
