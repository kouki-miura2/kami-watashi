import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'
import './fonts.css'
import './app.css'
import { createVuetify } from 'vuetify'

/**
 * The app's theme: off-white paper, ink, and vermilion.
 * Use these names (`color="secondary"`, `text-link`, ...) rather than raw hex values.
 */
export const vuetify = createVuetify({
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        colors: {
          background: '#F6F3EC',
          surface: '#FFFFFF',
          'surface-bright': '#FBF9F4',
          /** Tracks, segmented controls, and other quiet fills. */
          'surface-light': '#ECE8DE',
          'on-background': '#1F1D1A',
          'on-surface': '#1F1D1A',
          /** Ink: main buttons and selected states. */
          primary: '#1F1D1A',
          /** Vermilion: mitene, unread marks, and the main confirming action. */
          secondary: '#D9542B',
          /** Links and text-colored actions. */
          link: '#B8431F',
          error: '#B3261E',
          /** Response status 「未対応」 / 「対応済」 labels. */
          todo: '#FBEBC8',
          'on-todo': '#7A5200',
          done: '#DDEDE2',
          'on-done': '#2A5E40',
          /** Dark backdrop of the print detail screen, where the photo is the focus. */
          'print-backdrop': '#2A2824',
        },
      },
    },
  },
  defaults: {
    VBtn: { rounded: 'pill' },
    // Inside a button group (`v-btn-toggle`), the group rounds its ends; a pill on every button
    // would split it into separate pills instead of one divided control.
    VBtnGroup: { VBtn: { rounded: false } },
    VCard: { rounded: 'lg', variant: 'flat', border: true },
    VBottomNavigation: { bgColor: 'surface-bright', border: 't', elevation: 0 },
  },
})
