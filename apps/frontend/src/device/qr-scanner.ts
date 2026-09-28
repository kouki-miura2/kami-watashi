import {
  CapacitorBarcodeScanner,
  CapacitorBarcodeScannerTypeHint,
} from '@capacitor/barcode-scanner'
import { Capacitor } from '@capacitor/core'

import { isCancellation } from '../lib/cancellation.ts'

/**
 * Reading the owner's invite QR code (1d) with the device camera, through the plugin's own
 * full-screen scanner. Only on the device: in the browser (development) the join screen takes a
 * pasted invite code instead of opening the webcam.
 */
export const qrScanner = {
  available: Capacitor.isNativePlatform(),

  /** The QR code's text, or `null` when the user backs out. */
  scan: async (): Promise<string | null> => {
    try {
      const { ScanResult } = await CapacitorBarcodeScanner.scanBarcode({
        hint: CapacitorBarcodeScannerTypeHint.QR_CODE,
        scanInstructions: '招待QRコードを枠の中に写してください',
      })
      return ScanResult || null
    } catch (error) {
      if (isCancellation(error)) return null
      throw error
    }
  },
}
