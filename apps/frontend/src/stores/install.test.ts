import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, expect, test, vi } from 'vite-plus/test'

import { useInstallStore } from './install.ts'

let browserWindow: EventTarget

const stubBrowser = ({ standalone = false, userAgent = 'Android Chrome', maxTouchPoints = 5 }) => {
  browserWindow = Object.assign(new EventTarget(), {
    matchMedia: () => ({ matches: standalone }),
  })
  vi.stubGlobal('window', browserWindow)
  vi.stubGlobal('navigator', { userAgent, maxTouchPoints })
}

const promptEvent = (outcome: 'accepted' | 'dismissed') =>
  Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt: vi.fn(async () => {}),
    userChoice: Promise.resolve({ outcome }),
  })

beforeEach(() => {
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('opens the browser’s install dialog once the browser has offered one', async () => {
  stubBrowser({})
  const install = useInstallStore()
  expect(install.canPrompt).toBe(false)
  expect(await install.install()).toBe(false)

  const event = promptEvent('accepted')
  browserWindow.dispatchEvent(event)
  expect(event.defaultPrevented).toBe(true)
  expect(install.canPrompt).toBe(true)

  expect(await install.install()).toBe(true)
  expect(event.prompt).toHaveBeenCalledOnce()
  expect(install.installed).toBe(true)
  // The event can't be used twice.
  expect(install.canPrompt).toBe(false)
})

test('stays uninstalled when the dialog is dismissed', async () => {
  stubBrowser({})
  const install = useInstallStore()
  browserWindow.dispatchEvent(promptEvent('dismissed'))

  await install.install()

  expect(install.installed).toBe(false)
})

test('knows it is installed when opened from the home screen, or once installed', () => {
  stubBrowser({ standalone: true })
  expect(useInstallStore().installed).toBe(true)

  setActivePinia(createPinia())
  stubBrowser({})
  const install = useInstallStore()
  browserWindow.dispatchEvent(new Event('appinstalled'))
  expect(install.installed).toBe(true)
})

test('tells iPhones and iPads (which report a Mac with touch) apart', () => {
  stubBrowser({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X)' })
  expect(useInstallStore().isIos).toBe(true)

  setActivePinia(createPinia())
  stubBrowser({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 5 })
  expect(useInstallStore().isIos).toBe(true)

  setActivePinia(createPinia())
  stubBrowser({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 0 })
  expect(useInstallStore().isIos).toBe(false)
})
