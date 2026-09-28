import { type QueryClient, useQuery } from '@tanstack/vue-query'
import { computed, type MaybeRefOrGetter, toValue } from 'vue'

import { apiClient } from '../api/client.ts'

const IMAGES_KEY = 'images'

/**
 * A print photo as an object URL for `<img src>`: `/images/:id` needs the `Authorization` header,
 * which an `<img>` can't send. An image id is never reused (retaking creates new ids), so it never
 * goes stale; the browser's HTTP cache (`immutable`) serves repeat fetches.
 */
export const useImageQuery = (
  imageId: MaybeRefOrGetter<string | null>,
  queryClient?: QueryClient,
) =>
  useQuery(
    {
      queryKey: computed(() => [IMAGES_KEY, toValue(imageId)]),
      queryFn: async () => {
        const response = await apiClient.images[':id'].$get({ param: { id: toValue(imageId)! } })
        return URL.createObjectURL(await response.blob())
      },
      enabled: computed(() => toValue(imageId) !== null),
      staleTime: Infinity,
    },
    queryClient,
  )

/** Frees an image's object URL once its query leaves the cache. Call once for the app's client. */
export const revokeImageUrlsOnRemoval = (queryClient: QueryClient) =>
  queryClient.getQueryCache().subscribe((event) => {
    const { queryKey, state } = event.query
    if (event.type === 'removed' && queryKey[0] === IMAGES_KEY && typeof state.data === 'string') {
      URL.revokeObjectURL(state.data)
    }
  })
