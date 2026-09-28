/**
 * Whether a device feature (camera, gallery, QR scanner, Google sign-in) failed only because the
 * user backed out — not an error to report. Capacitor plugins say so in the message.
 */
export const isCancellation = (error: unknown): boolean =>
  error instanceof Error && /cancel/i.test(error.message)
