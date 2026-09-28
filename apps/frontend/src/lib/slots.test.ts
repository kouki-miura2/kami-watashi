import { expect, test } from 'vite-plus/test'

import { COMMON_SLOT, slotParam, toSlotCards } from './slots.ts'

test('slotParam uses the child id, or common for the family-common slot', () => {
  expect(slotParam('c1')).toBe('c1')
  expect(slotParam(null)).toBe(COMMON_SLOT)
})

test('toSlotCards puts the family-common slot last, children in their order', () => {
  const cards = toSlotCards([
    { id: null, name: '家族共通' },
    { id: 'c1', name: 'はなこ' },
    { id: 'c2', name: 'たろう' },
  ])

  expect(cards.map((card) => card.param)).toEqual(['c1', 'c2', 'common'])
  expect(cards.map((card) => card.initial)).toEqual(['は', 'た', '家'])
})

test('toSlotCards gives children distinct colors and the common slot its own', () => {
  const cards = toSlotCards([
    { id: null, name: '家族共通' },
    { id: 'c1', name: 'はなこ' },
    { id: 'c2', name: 'たろう' },
  ])

  expect(cards[0]!.color).not.toBe(cards[1]!.color)
  expect(cards[2]!.color).toBe('#6B665C')
})

test('the initial is the first visible character, even a multi-code-point one', () => {
  expect(toSlotCards([{ id: 'c1', name: '👨‍👩‍👧家' }])[0]!.initial).toBe('👨‍👩‍👧')
})
