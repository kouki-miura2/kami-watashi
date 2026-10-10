import { type QueryClient, useMutation } from '@tanstack/vue-query'
import { LIMITS } from 'utils'

import { apiClient } from '../api/client.ts'
import { readPhotoQrCodes } from '../device/qr-codes.ts'

export type PrintQrCode = { text: string; page: number }

/** User-triggered read of the displayed photo, including one extra code for overflow. */
export const usePrintQrCodes = (queryClient?: QueryClient) =>
  useMutation(
    {
      mutationFn: async ({
        imageId,
        page,
      }: {
        imageId: string
        page: number
      }): Promise<PrintQrCode[]> => {
        const response = await apiClient.images[':id'].$get({ param: { id: imageId } })
        const texts = await readPhotoQrCodes(await response.blob(), LIMITS.printQrCodes)
        return texts.map((text) => ({ text, page }))
      },
    },
    queryClient,
  )
