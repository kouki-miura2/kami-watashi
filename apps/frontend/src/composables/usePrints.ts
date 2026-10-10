import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, type MaybeRefOrGetter, toValue } from 'vue'

import { apiClient } from '../api/client.ts'
import { type PrintFilter, type ResponseStatus, toApiQuery } from '../lib/print-filter.ts'
import { COMMON_SLOT } from '../lib/slots.ts'
import { invalidate, queryKeys } from './query-keys.ts'

/** Uploading up to `LIMITS.printImages` photos takes far longer than the default request timeout. */
const UPLOAD_TIMEOUT_MS = 60_000

export type { ResponseStatus }

/** A detail query's key: under the `prints` prefix, so everything that refreshes prints covers it. */
const detailKey = (id: string) => [...queryKeys.prints, 'detail', id]

/** Every print list, but not the details (refetching a detail marks it read again). */
const isListQuery = ({ queryKey }: { queryKey: readonly unknown[] }) =>
  queryKey[0] === queryKeys.prints[0] && queryKey[1] !== 'detail'

const toPhotoFiles = (photos: Blob[]) =>
  photos.map((photo, index) => {
    const type = photo.type || 'image/webp'
    return new File([photo], `page-${index + 1}.${type === 'image/jpeg' ? 'jpg' : 'webp'}`, {
      type,
    })
  })

/** `GET /prints`: a slot's prints in the filter's order. */
export const usePrintsQuery = (
  slot: MaybeRefOrGetter<string>,
  filter: MaybeRefOrGetter<PrintFilter>,
  queryClient?: QueryClient,
) =>
  useQuery(
    {
      queryKey: computed(() => [...queryKeys.prints, toValue(slot), toValue(filter)]),
      queryFn: async () =>
        (await apiClient.prints.$get({ query: toApiQuery(toValue(slot), toValue(filter)) })).json(),
    },
    queryClient,
  )

/**
 * `GET /prints/:id`. Opening a print marks it read and turns a mitene sent to the caller into
 * 見たよ (server side), so the lists and the home badges are refreshed after it loads.
 */
export const usePrintQuery = (id: MaybeRefOrGetter<string>, queryClient?: QueryClient) => {
  const client = queryClient ?? useQueryClient()
  return useQuery(
    {
      queryKey: computed(() => detailKey(toValue(id))),
      queryFn: async () => {
        const print = await (
          await apiClient.prints[':id'].$get({ param: { id: toValue(id) } })
        ).json()
        void client.invalidateQueries({ predicate: isListQuery })
        void client.invalidateQueries({ queryKey: queryKeys.children })
        return print
      },
    },
    client,
  )
}

export interface NewPrint {
  /** A child id, or `common` (`slotParam`). */
  slot: string
  title: string
  /** `YYYY-MM-DD`; empty or `null` (a cleared field) for none. */
  receivedOn: string | null
  /** `YYYY-MM-DD`; empty or `null` (a cleared field) for none. */
  dueOn: string | null
  topicIds: string[]
  responseStatus: ResponseStatus
  /** Optimized WebP photos, in page order. */
  photos: Blob[]
}

/** The print form's fields (`PrintForm`); `slot` is empty until chosen. */
export type PrintFormValues = Omit<NewPrint, 'photos'>

/** Everything a new, changed, moved, or deleted print shows up in. */
const afterPrintChange = (client: QueryClient) =>
  invalidate(client, [
    queryKeys.children,
    queryKeys.prints,
    queryKeys.topics,
    queryKeys.histories,
    queryKeys.stats,
  ])

/**
 * Registers a print (`POST /prints`, multipart). The registration screen shows failures itself —
 * `storage_limit` gets its own dialog — so the app-wide snackbar is skipped.
 */
export const useCreatePrintMutation = (queryClient?: QueryClient) => {
  const client = queryClient ?? useQueryClient()
  return useMutation(
    {
      mutationFn: async (print: NewPrint) =>
        (
          await apiClient.prints.$post(
            {
              form: {
                childId: print.slot,
                title: print.title,
                // An empty field is "none"; `null` would be sent as the text "null".
                receivedOn: print.receivedOn ?? '',
                dueOn: print.dueOn ?? '',
                topicIds: print.topicIds,
                responseStatus: print.responseStatus,
                images: toPhotoFiles(print.photos),
              },
            },
            { init: { signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS) } },
          )
        ).json(),
      onSuccess: () => afterPrintChange(client),
      meta: { handlesError: true },
    },
    client,
  )
}

/** The fields a change can set; left out means unchanged. `slot` moves the print. */
export interface PrintChanges {
  slot?: string
  title?: string
  receivedOn?: string | null
  dueOn?: string | null
  topicIds?: string[]
  responseStatus?: ResponseStatus
}

/**
 * `PATCH /prints/:id`: changes fields, moves it to another slot (a new number there), or both.
 * Resolves where the print ended up (`{ id, childId, seq }`).
 */
export const useUpdatePrintMutation = (queryClient?: QueryClient) => {
  const client = queryClient ?? useQueryClient()
  return useMutation(
    {
      mutationFn: async ({ id, changes }: { id: string; changes: PrintChanges }) => {
        const { slot, receivedOn, dueOn, ...rest } = changes
        return (
          await apiClient.prints[':id'].$patch({
            param: { id },
            json: {
              ...rest,
              ...(slot === undefined ? {} : { childId: slot === COMMON_SLOT ? null : slot }),
              // An empty date field clears the date.
              ...(receivedOn === undefined ? {} : { receivedOn: receivedOn || null }),
              ...(dueOn === undefined ? {} : { dueOn: dueOn || null }),
            },
          })
        ).json()
      },
      onSuccess: () => afterPrintChange(client),
    },
    client,
  )
}

/**
 * `PUT /prints/:id/images`: retakes every page. On `storage_limit` the original photos stay; the
 * edit screen shows that itself. For additions, prepend the existing photos unchanged.
 */
export const useReplacePhotosMutation = (queryClient?: QueryClient) => {
  const client = queryClient ?? useQueryClient()
  return useMutation(
    {
      mutationFn: async ({
        id,
        photos,
        existingImageIds = [],
      }: {
        id: string
        photos: Blob[]
        existingImageIds?: string[]
      }) => {
        const existing = await Promise.all(
          existingImageIds.map(async (imageId) =>
            (await apiClient.images[':id'].$get({ param: { id: imageId } })).blob(),
          ),
        )
        return (
          await apiClient.prints[':id'].images.$put(
            { param: { id }, form: { images: toPhotoFiles([...existing, ...photos]) } },
            { init: { signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS) } },
          )
        ).json()
      },
      onSuccess: () => afterPrintChange(client),
      meta: { handlesError: true },
    },
    client,
  )
}

export const useDeletePrintMutation = (queryClient?: QueryClient) => {
  const client = queryClient ?? useQueryClient()
  return useMutation(
    {
      mutationFn: async (id: string) => {
        await apiClient.prints[':id'].$delete({ param: { id } })
      },
      // Drop the deleted print's detail instead of refetching it (it would 404).
      onSuccess: async (_result, id) => {
        client.removeQueries({ queryKey: detailKey(id) })
        await Promise.all([
          client.invalidateQueries({ predicate: isListQuery }),
          invalidate(client, [
            queryKeys.children,
            queryKeys.topics,
            queryKeys.histories,
            queryKeys.stats,
          ]),
        ])
      },
    },
    client,
  )
}

/** Sends mitene about a print to these members (each one's state becomes 見てね from the caller). */
export const useSendMiteneMutation = (queryClient?: QueryClient) => {
  const client = queryClient ?? useQueryClient()
  return useMutation(
    {
      mutationFn: async ({ id, memberIds }: { id: string; memberIds: string[] }) => {
        await apiClient.prints[':id'].mitene.$post({ param: { id }, json: { memberIds } })
      },
      onSuccess: (_result, { id }) => client.invalidateQueries({ queryKey: detailKey(id) }),
    },
    client,
  )
}
