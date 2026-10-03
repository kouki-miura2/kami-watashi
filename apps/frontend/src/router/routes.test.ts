import { expect, test } from 'vite-plus/test'
import { createMemoryHistory, createRouter } from 'vue-router'

import { routes } from './routes.ts'

const router = createRouter({ history: createMemoryHistory(), routes })

test.each([
  ['/', 'home'],
  ['/histories', 'histories'],
  ['/stats', 'stats'],
  ['/settings', 'settings'],
])('resolves the %s tab and marks it as a tab', (path, name) => {
  const resolved = router.resolve(path)

  expect(resolved.name).toBe(name)
  expect(resolved.meta.tab).toBe(true)
})

test.each([
  ['/welcome', 'welcome'],
  ['/join', 'join'],
  ['/removed', 'removed'],
])('resolves %s as a public route', (path, name) => {
  const resolved = router.resolve(path)

  expect(resolved.name).toBe(name)
  expect(resolved.meta.public).toBe(true)
})

test.each([
  ['/settings/children', 'children'],
  ['/settings/topics', 'topics'],
  ['/settings/bulk-delete', 'bulk-delete'],
])('resolves %s as a signed-in screen below the tabs', (path, name) => {
  const resolved = router.resolve(path)

  expect(resolved.name).toBe(name)
  expect(resolved.meta).toEqual({})
})

test("resolves a slot's prints with the slot as a parameter", () => {
  const resolved = router.resolve('/slots/common/prints?mitene=requested')

  expect(resolved.name).toBe('prints')
  expect(resolved.params.slot).toBe('common')
  expect(resolved.query.mitene).toBe('requested')
})

test('resolves print registration with the preselected slot', () => {
  const resolved = router.resolve('/prints/new?slot=c1')

  expect(resolved.name).toBe('print-new')
  expect(resolved.query.slot).toBe('c1')
})

test('resolves a print and its edit screen by id, not taking `new` for an id', () => {
  expect(router.resolve('/prints/p1').name).toBe('print')
  expect(router.resolve('/prints/p1').params.id).toBe('p1')
  expect(router.resolve('/prints/p1/edit').name).toBe('print-edit')
  expect(router.resolve('/prints/new').name).toBe('print-new')
})

test('resolves the invite screen as owner-only', () => {
  const resolved = router.resolve('/settings/invite')

  expect(resolved.name).toBe('invite')
  expect(resolved.meta.ownerOnly).toBe(true)
})

test('resolves the terms screen as a signed-in, non-tab screen', () => {
  const resolved = router.resolve('/terms')

  expect(resolved.name).toBe('terms')
  expect(resolved.meta.public).toBeUndefined()
  expect(resolved.meta.tab).toBeUndefined()
})

test('redirects an unknown path to home', () => {
  const resolved = router.resolve('/does-not-exist')

  expect(resolved.matched[0]?.redirect).toEqual({ name: 'home' })
})

test.each(['terms', 'privacy'])('resolves /legal/%s for anyone, with the document kind', (kind) => {
  const resolved = router.resolve(`/legal/${kind}`)

  expect(resolved.name).toBe('legal')
  expect(resolved.params.kind).toBe(kind)
  expect(resolved.meta.anyone).toBe(true)
})

test('takes no other document than the terms and privacy policy', () => {
  expect(router.resolve('/legal/help').matched[0]?.redirect).toEqual({ name: 'home' })
})
