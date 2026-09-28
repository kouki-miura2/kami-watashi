import { charLength, LIMITS } from 'utils'

/** A Vuetify `rules` entry: `true` when valid, otherwise the message to show. */
export type Rule = (value: string) => true | string

/**
 * Rules for a child name, topic name, or display name: required, at most `LIMITS.nameMaxLength`
 * characters (counted with `charLength`, as the API does), surrounding spaces ignored.
 */
export const nameRules: Rule[] = [
  (value) => value.trim() !== '' || '名前を入力してください',
  (value) =>
    charLength(value.trim()) <= LIMITS.nameMaxLength ||
    `${LIMITS.nameMaxLength}文字以内で入力してください`,
]

/** Rules for a print title: optional, at most `LIMITS.titleMaxLength` characters. */
export const titleRules: Rule[] = [
  (value) =>
    charLength(value.trim()) <= LIMITS.titleMaxLength ||
    `${LIMITS.titleMaxLength}文字以内で入力してください`,
]
