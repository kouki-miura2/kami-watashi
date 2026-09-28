import { expect, test } from 'vite-plus/test'
import { createMemoryHistory, createRouter } from 'vue-router'

import { resolveNavigation } from './guard.ts'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'home', component: {} },
    { path: '/welcome', name: 'welcome', component: {}, meta: { public: true } },
    { path: '/invite', name: 'invite', component: {}, meta: { ownerOnly: true } },
  ],
})

const to = (path: string) => router.resolve(path) as Parameters<typeof resolveNavigation>[0]
const signedOut = { isSignedIn: false, isOwner: false }
const owner = { isSignedIn: true, isOwner: true }
const member = { isSignedIn: true, isOwner: false }

test('sends a signed-out device to welcome', () => {
  expect(resolveNavigation(to('/'), signedOut)).toEqual({ name: 'welcome' })
})

test('lets a signed-out device open public routes', () => {
  expect(resolveNavigation(to('/welcome'), signedOut)).toBe(true)
})

test('sends a signed-in device away from public routes', () => {
  expect(resolveNavigation(to('/welcome'), member)).toEqual({ name: 'home' })
})

test('lets only owners open owner-only routes', () => {
  expect(resolveNavigation(to('/invite'), owner)).toBe(true)
  expect(resolveNavigation(to('/invite'), member)).toEqual({ name: 'home' })
})

test('lets a signed-in device open ordinary routes', () => {
  expect(resolveNavigation(to('/'), member)).toBe(true)
})
