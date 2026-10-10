import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import vuetify from 'vite-plugin-vuetify'
import { defineConfig } from 'vite-plus'

export default defineConfig({
  test: {
    // Vitest v4 compatibility: preserve mock call history.
    // Remove after tests no longer rely on calls from setup or earlier tests.
    // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
    // https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
    clearMocks: false,
  },
  plugins: [
    vue(),
    vuetify({ autoImport: true }),
    // A new build waits for 「更新」. Registration belongs to usePwaUpdate; off in vp dev.
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      // Keep the existing home screen manifest in public/ and index.html.
      manifest: false,
      workbox: {
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,wasm,webmanifest}'],
        navigateFallbackDenylist: [/^\/api(?:\/|$)/],
      },
    }),
  ],
  // The API on the dev server's own origin, as deployed (the Worker serves both): `wrangler dev`
  // (`vp run backend-worker#dev`) also mounts it under `/api`.
  server: { proxy: { '/api': 'http://localhost:8787' } },
  // Pre-bundling would move its code away from the `.wasm` files it finds via `import.meta.url`.
  optimizeDeps: {
    exclude: ['@jsquash/webp', 'vuetify'],
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {},
})
