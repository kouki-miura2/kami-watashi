import { expect, test, vi } from 'vite-plus/test'
import { createMemoryHistory, createRouter } from 'vue-router'

import { useBack } from './useBack.ts'

const { useRouter } = vi.hoisted(() => ({ useRouter: vi.fn() }))
vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-router')>()),
  useRouter,
}))

test('returning from repeated edits leaves the detail with one back operation', async () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: ['/list', '/detail', '/edit'].map((path) => ({ path, component: {} })),
  })
  useRouter.mockReturnValue(router)
  vi.stubGlobal('window', { history: { state: { back: '/detail' } } })
  try {
    await router.push('/list')
    await router.push('/detail')
    const back = useBack('/detail')
    const returnBack = async () => {
      const finished = new Promise<void>((resolve) => {
        const stop = router.afterEach(() => {
          stop()
          resolve()
        })
      })
      void back()
      await finished
    }
    for (let i = 0; i < 3; i++) {
      await router.push('/edit')
      await returnBack()
      expect(router.currentRoute.value.path).toBe('/detail')
    }
    await returnBack()
    expect(router.currentRoute.value.path).toBe('/list')
  } finally {
    vi.unstubAllGlobals()
  }
})
