import { LIMITS } from 'utils'
import { expect, test } from 'vite-plus/test'

import { nameRules, type Rule, titleRules } from './validation.ts'

const check = (rules: Rule[], value: string) => {
  for (const rule of rules) {
    const result = rule(value)
    if (result !== true) return result
  }
  return true
}

test('nameRules requires a name', () => {
  expect(check(nameRules, '')).toBe('名前を入力してください')
  expect(check(nameRules, '   ')).toBe('名前を入力してください')
  expect(check(nameRules, 'はなこ')).toBe(true)
})

test('nameRules limits the length, counting each visible character once', () => {
  expect(check(nameRules, 'あ'.repeat(LIMITS.nameMaxLength))).toBe(true)
  expect(check(nameRules, '👨‍👩‍👧'.repeat(LIMITS.nameMaxLength))).toBe(true)
  expect(check(nameRules, 'a'.repeat(LIMITS.nameMaxLength + 1))).toBe(
    `${LIMITS.nameMaxLength}文字以内で入力してください`,
  )
})

test('nameRules ignores surrounding spaces when counting', () => {
  expect(check(nameRules, ` ${'a'.repeat(LIMITS.nameMaxLength)} `)).toBe(true)
})

test('titleRules allows an empty title and limits the length', () => {
  expect(check(titleRules, '')).toBe(true)
  expect(check(titleRules, 'あ'.repeat(LIMITS.titleMaxLength))).toBe(true)
  expect(check(titleRules, 'あ'.repeat(LIMITS.titleMaxLength + 1))).toBe(
    `${LIMITS.titleMaxLength}文字以内で入力してください`,
  )
})
