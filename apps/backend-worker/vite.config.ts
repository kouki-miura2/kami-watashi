import { defineConfig } from 'vite-plus'

export default defineConfig({
  run: {
    tasks: {
      // Share the frontend build with `vp run -r build` instead of running it twice in parallel.
      build: {
        command: 'wrangler deploy --dry-run --outdir dist',
        dependsOn: ['frontend#build'],
      },
    },
  },
})
