import { QueryClient } from '@tanstack/vue-query'
import { beforeEach, expect, test, vi } from 'vite-plus/test'
import { effectScope } from 'vue'

import { apiClient } from '../api/client.ts'
import { TERMS_VERSION } from '../terms.ts'
import { queryKeys } from './query-keys.ts'
import { useAgreeTermsMutation } from './useAgreeTermsMutation.ts'

vi.mock('../api/client.ts', () => ({ apiClient: { me: { terms: { $post: vi.fn() } } } }))

beforeEach(() => {
  vi.clearAllMocks()
})

test('agrees to the current terms and refetches /launch', async () => {
  vi.mocked(apiClient.me.terms.$post).mockResolvedValue(new Response(null) as never)
  const queryClient = new QueryClient()
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
  const agree = effectScope().run(() => useAgreeTermsMutation(queryClient))!

  await agree.mutateAsync()

  expect(apiClient.me.terms.$post).toHaveBeenCalledWith({ json: { termsVersion: TERMS_VERSION } })
  expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.launch })
})
