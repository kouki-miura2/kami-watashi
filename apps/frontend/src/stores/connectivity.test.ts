import { onlineManager } from '@tanstack/vue-query'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, expect, test } from 'vite-plus/test'

import { useConnectivityStore } from './connectivity.ts'

beforeEach(() => {
  setActivePinia(createPinia())
  onlineManager.setOnline(true)
})

test('follows the online status that TanStack Query sees', () => {
  const connectivity = useConnectivityStore()
  expect(connectivity.online).toBe(true)

  onlineManager.setOnline(false)
  expect(connectivity.online).toBe(false)

  onlineManager.setOnline(true)
  expect(connectivity.online).toBe(true)
})
