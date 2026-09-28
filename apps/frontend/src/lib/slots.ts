import { truncateChars } from 'utils'

/** The family-common slot in URLs and query parameters (JSON bodies use `null`, as the API does). */
export const COMMON_SLOT = 'common'

/** A slot's route/query parameter: the child id, or `common`. */
export const slotParam = (childId: string | null): string => childId ?? COMMON_SLOT

/** Children's colors (avatars, graphs), assigned in registration order and repeating. */
const CHILD_COLORS = ['#D9542B', '#2F5D8A', '#3E7D5A', '#9A6A00', '#7B4B94', '#1F7A7A']
const COMMON_SLOT_COLOR = '#6B665C'

export interface SlotCard<T> {
  slot: T
  /** Route/query parameter (`slotParam`). */
  param: string
  color: string
  /** The name's first character, for the avatar. */
  initial: string
}

/**
 * The home list's order: children in registration order, then the family-common slot, which the
 * design keeps last. Each gets its color and avatar initial.
 */
export const toSlotCards = <T extends { id: string | null; name: string }>(
  slots: T[],
): SlotCard<T>[] => {
  const children = slots.filter((slot) => slot.id !== null)
  const common = slots.filter((slot) => slot.id === null)
  return [
    ...children.map((slot, index) => ({
      slot,
      param: slotParam(slot.id),
      color: CHILD_COLORS[index % CHILD_COLORS.length]!,
      initial: truncateChars(slot.name, 1),
    })),
    ...common.map((slot) => ({
      slot,
      param: COMMON_SLOT,
      color: COMMON_SLOT_COLOR,
      initial: truncateChars(slot.name, 1),
    })),
  ]
}
