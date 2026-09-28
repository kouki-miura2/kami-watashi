const segmenter = new Intl.Segmenter('ja', { granularity: 'grapheme' })

/**
 * Length of a string as the spec counts it: every character a person sees is one, full-width or
 * half-width. Counts grapheme clusters, so a surrogate pair (𠮷) or a combined emoji (👨‍👩‍👧) is
 * one, where `String.prototype.length` would say 2 or 8. Used for the name/title limits in
 * `LIMITS`, both in the UI and the API.
 */
export const charLength = (value: string): number => {
  let count = 0
  for (const _ of segmenter.segment(value)) count++
  return count
}

/** The first `max` characters of `value`, counted the same way as `charLength`. */
export const truncateChars = (value: string, max: number): string => {
  let result = ''
  let count = 0
  for (const { segment } of segmenter.segment(value)) {
    if (count === max) break
    result += segment
    count++
  }
  return result
}
