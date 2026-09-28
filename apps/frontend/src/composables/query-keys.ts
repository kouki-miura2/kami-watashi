import type { QueryClient } from '@tanstack/vue-query'

/**
 * Query key prefixes, one per API resource. A mutation invalidates every prefix whose data it can
 * change; longer keys (e.g. `['prints', slot, filter]`) start with their prefix so invalidating
 * it covers them.
 */
export const queryKeys = {
  launch: ['launch'],
  members: ['members'],
  children: ['children'],
  topics: ['topics'],
  prints: ['prints'],
  histories: ['histories'],
  stats: ['stats'],
} as const

export type QueryKeyPrefix = (typeof queryKeys)[keyof typeof queryKeys]

/** Refetches (or marks stale) every query under these prefixes. */
export const invalidate = (client: QueryClient, prefixes: QueryKeyPrefix[]) =>
  Promise.all(prefixes.map((queryKey) => client.invalidateQueries({ queryKey })))
