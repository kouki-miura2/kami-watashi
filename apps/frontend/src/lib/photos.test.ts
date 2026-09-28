import { expect, test } from 'vite-plus/test'

import { fitLongEdge } from './photos.ts'

test('keeps a photo whose long edge already fits', () => {
  expect(fitLongEdge(1920, 1080, 1920)).toEqual({ width: 1920, height: 1080 })
  expect(fitLongEdge(800, 600, 1920)).toEqual({ width: 800, height: 600 })
})

test('scales a larger photo down to the long edge, keeping the aspect ratio', () => {
  expect(fitLongEdge(4032, 3024, 1920)).toEqual({ width: 1920, height: 1440 })
  // Portrait: the height is the long edge.
  expect(fitLongEdge(3024, 4032, 1920)).toEqual({ width: 1440, height: 1920 })
})

test('never rounds a very thin photo down to zero', () => {
  expect(fitLongEdge(10_000, 1, 1920)).toEqual({ width: 1920, height: 1 })
})
