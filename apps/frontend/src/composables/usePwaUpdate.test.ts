import { useRegisterSW } from 'virtual:pwa-register/vue'
import { afterEach, beforeEach, expect, test, vi } from 'vite-plus/test'
import { effectScope, ref } from 'vue'

import { usePwaUpdate } from './usePwaUpdate.ts'

vi.mock('virtual:pwa-register/vue', () => ({ useRegisterSW: vi.fn() }))

let scope: ReturnType<typeof effectScope>
let page: EventTarget & { visibilityState: string }
const updateServiceWorker = vi.fn(async () => {})

beforeEach(() => {
  vi.useFakeTimers()
  scope = effectScope()
  page = Object.assign(new EventTarget(), { visibilityState: 'visible' })
  vi.stubGlobal('document', page)
  vi.mocked(useRegisterSW).mockReturnValue({
    needRefresh: ref(false),
    offlineReady: ref(false),
    updateServiceWorker,
  })
  updateServiceWorker.mockClear()
})

afterEach(() => {
  scope.stop()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const setup = () => {
  const pwa = scope.run(usePwaUpdate)!
  const options = vi.mocked(useRegisterSW).mock.lastCall![0]!
  const check = vi.fn(async () => ({}) as ServiceWorkerRegistration)
  options.onRegisteredSW!('/sw.js', { update: check } as unknown as ServiceWorkerRegistration)
  return { pwa, options, check }
}

test('checks on return to the foreground and every hour, without activating an update', () => {
  const { check } = setup()
  page.visibilityState = 'hidden'
  page.dispatchEvent(new Event('visibilitychange'))
  expect(check).not.toHaveBeenCalled()
  page.visibilityState = 'visible'
  page.dispatchEvent(new Event('visibilitychange'))
  expect(check).toHaveBeenCalledTimes(1)
  vi.advanceTimersByTime(60 * 60 * 1000)
  expect(check).toHaveBeenCalledTimes(2)
  expect(updateServiceWorker).not.toHaveBeenCalled()
})

test('later dismisses the prompt; only update activates the waiting worker', () => {
  const { pwa } = setup()
  pwa.needRefresh.value = true
  pwa.needRefresh.value = false
  expect(updateServiceWorker).not.toHaveBeenCalled()
  pwa.update()
  expect(updateServiceWorker).toHaveBeenCalledOnce()
})

test('a failed offline check is retried at the next interval', async () => {
  const { check } = setup()
  check.mockRejectedValueOnce(new Error('offline'))
  await vi.advanceTimersByTimeAsync(2 * 60 * 60 * 1000)
  expect(check).toHaveBeenCalledTimes(2)
})

test('closing the scope removes the interval and foreground listener', () => {
  const { check } = setup()
  scope.stop()
  page.dispatchEvent(new Event('visibilitychange'))
  vi.advanceTimersByTime(60 * 60 * 1000)
  expect(check).not.toHaveBeenCalled()
})

test('a registration completed after disposal never starts checking', () => {
  const pwa = scope.run(usePwaUpdate)!
  const options = vi.mocked(useRegisterSW).mock.lastCall![0]!
  scope.stop()
  const check = vi.fn()
  options.onRegisteredSW!('/sw.js', { update: check } as unknown as ServiceWorkerRegistration)
  page.dispatchEvent(new Event('visibilitychange'))
  vi.advanceTimersByTime(60 * 60 * 1000)
  expect(check).not.toHaveBeenCalled()
  expect(pwa.needRefresh.value).toBe(false)
})
