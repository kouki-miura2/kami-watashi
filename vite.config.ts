import { defineConfig } from 'vite-plus'

// Capacitor's generated native projects (and the web build copied into them) are not ours to format or lint.
const nativeProjects = ['apps/frontend/android/**', 'apps/frontend/ios/**']

export default defineConfig({
  staged: {
    '*': 'vp check --fix',
  },
  fmt: {
    ignorePatterns: nativeProjects,
    semi: false,
    singleQuote: true,
    sortImports: true,
  },
  lint: {
    ignorePatterns: nativeProjects,
    jsPlugins: [{ name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' }],
    rules: {
      'vite-plus/prefer-vite-plus-imports': 'error',
      'func-style': ['error', 'expression'],
      'prefer-arrow-callback': 'error',
    },
    options: { typeAware: true, typeCheck: true },
  },
  run: {
    cache: true,
  },
})
