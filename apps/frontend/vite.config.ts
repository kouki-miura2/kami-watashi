import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import { defineConfig } from 'vite-plus'

export default defineConfig({
  plugins: [vue(), vuetify({ autoImport: true })],
  // The API on the dev server's own origin, as deployed (the Worker serves both): `wrangler dev`
  // (`vp run backend-worker#dev`) also mounts it under `/api`.
  server: { proxy: { '/api': 'http://localhost:8787' } },
  // Pre-bundling would move its code away from the `.wasm` files it finds via `import.meta.url`.
  optimizeDeps: { exclude: ['@jsquash/webp'] },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {},
})
