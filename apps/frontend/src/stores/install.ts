import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

/** Chrome's (Android, desktop) install prompt event; not in the DOM types yet. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * Installing the app to the home screen (PWA). Chrome hands over a `beforeinstallprompt` event
 * that opens its install dialog from a tap; Safari (so every iPhone browser) has no such API, and
 * the settings screen shows how to add it from the share menu instead. Create it at startup
 * (`main.ts`): the event fires once, right after the page loads.
 */
export const useInstallStore = defineStore('install', () => {
  const installed = ref(
    window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone === true,
  )
  const promptEvent = shallowRef<BeforeInstallPromptEvent>()
  // iPadOS reports itself as a Mac, told apart by its touch screen.
  const isIos =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1)

  window.addEventListener('beforeinstallprompt', (event) => {
    // Keep Chrome's own banner away: the settings screen offers the install instead.
    event.preventDefault()
    promptEvent.value = event as BeforeInstallPromptEvent
  })
  window.addEventListener('appinstalled', () => {
    installed.value = true
    promptEvent.value = undefined
  })

  /** Opens the browser's install dialog; `false` when it can't (show the manual steps instead). */
  const install = async (): Promise<boolean> => {
    const event = promptEvent.value
    if (!event) return false
    // An event opens the dialog only once.
    promptEvent.value = undefined
    await event.prompt()
    if ((await event.userChoice).outcome === 'accepted') installed.value = true
    return true
  }

  return { installed, isIos, canPrompt: computed(() => promptEvent.value !== undefined), install }
})
