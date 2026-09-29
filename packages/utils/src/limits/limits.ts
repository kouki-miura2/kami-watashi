/**
 * App-wide limits and tunable values. Single source of truth for `docs/spec.md` "リミット値".
 * These may change during development or operation — change them here only, and keep the spec table in sync.
 */
export const LIMITS = {
  /** Storage quota per family, in bytes (300 MB). */
  familyStorageBytes: 300 * 1024 * 1024,
  /** Max members per family, including the owner. */
  familyMembers: 3,
  /** Max children per family (the family-common slot not counted). Checked in both the UI and the API. */
  familyChildren: 5,
  /** Max topics (the topic master) per family. Checked in both the UI and the API. */
  familyTopics: 15,
  /** Max photos (pages) per print. Checked in both the UI and the API, not by a DB constraint. */
  printImages: 5,
  /** Max topics per print. Checked in both the UI and the API, not by a DB constraint. */
  printTopics: 5,
  /** Photos are downscaled so their long edge is at most this many pixels. Provisional — finalize before launch. */
  imageLongEdgePx: 1920,
  /** WebP quality (0–1) used when converting photos on the device before upload. Provisional. */
  imageQuality: 0.8,
  /** Family data is auto-deleted after this many days without an app launch. */
  autoDeleteDays: 365,
  /** Invite tokens (in the QR code) expire this many minutes after issue. Provisional. */
  inviteTokenTtlMinutes: 10,
  /** Number of calendar weeks (Monday start, incl. the current one) in the weekly stats graph. Provisional. */
  statsWeeks: 12,
  /** Number of calendar months (incl. the current one) in the monthly stats graph. Provisional. */
  statsMonths: 12,
  /** Max length (characters) of a child name, topic name, or member display name. */
  nameMaxLength: 20,
  /** Max length (characters) of a print title. */
  titleMaxLength: 50,
  /** Choices (in months) for bulk-deleting prints registered at least this long ago. */
  bulkDeleteMonths: [1, 3, 6, 12],
  /** Number of history entries loaded per page (newest first). Provisional. */
  historyPageSize: 50,
  /** Owner session lifetime in days. Extended on every app launch. */
  ownerSessionDays: 30,
} as const
