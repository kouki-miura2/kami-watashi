import { LIMITS, addJstMonths, createLogger, toJstDateString } from 'utils'

import type { StoredImage } from '../dao/image-storage.interface.ts'
import type { AuthenticatedUser } from '../repository/auth-guard.interface.ts'
import type { ChildRepository } from '../repository/child.repository.ts'
import type { ImageRef, ImageRepository } from '../repository/image.repository.ts'
import type {
  MiteneStatus,
  Print,
  PrintImage,
  PrintListItem,
  PrintRepository,
  ResponseStatus,
} from '../repository/print.repository.ts'
import type { TopicRepository } from '../repository/topic.repository.ts'
import { COMMON_SLOT_NAME } from './child.service.ts'
import { AppError } from './errors.ts'
import { type PrintHistoryFields, createdDetails, updatedDetails } from './print-history.ts'

export interface PrintFieldsInput {
  title: string | null
  receivedOn: string | null
  dueOn: string | null
  topicIds: string[]
  responseStatus: ResponseStatus
}

export interface CreatePrintInput extends PrintFieldsInput {
  /** `null` is the family-common slot. */
  childId: string | null
  /** JPEG photos in page order. */
  images: Blob[]
}

/** Only the given fields change; `childId` moves the print to another slot. */
export type PrintPatch = Partial<PrintFieldsInput & { childId: string | null }>

export interface PrintListFilter {
  childId: string | null
  sort: 'created' | 'due'
  topicIds: string[]
  read?: boolean
  responseStatus?: ResponseStatus
  miteneStatus?: MiteneStatus
}

export type PrintListItemView = Omit<PrintListItem, 'familyId'>

export interface PrintDetailView extends Omit<Print, 'familyId'> {
  topicIds: string[]
  images: { id: string; page: number }[]
  isRead: boolean
  miteneStatus: MiteneStatus
  /** Mitene the caller sent, per recipient. */
  miteneSent: { memberId: string; memberName: string; status: 'requested' | 'seen' }[]
  /** Mitene the caller received on this print. */
  miteneReceived: {
    fromMemberId: string | null
    fromMemberName: string | null
    status: 'requested' | 'seen'
  } | null
}

/** Where a print ended up after a create or update. */
export interface PrintRefView {
  id: string
  childId: string | null
  seq: number
}

export interface PrintService {
  list: (user: AuthenticatedUser, filter: PrintListFilter) => Promise<PrintListItemView[]>
  /** Opening the detail also marks it read and turns a received `requested` mitene into `seen`. */
  detail: (user: AuthenticatedUser, id: string) => Promise<PrintDetailView>
  create: (user: AuthenticatedUser, input: CreatePrintInput) => Promise<PrintRefView>
  update: (user: AuthenticatedUser, id: string, patch: PrintPatch) => Promise<PrintRefView>
  /** Retakes all pages. */
  replaceImages: (
    user: AuthenticatedUser,
    id: string,
    images: Blob[],
  ) => Promise<{ images: { id: string; page: number }[] }>
  delete: (user: AuthenticatedUser, id: string) => Promise<void>
  /** Prints registered at least `months` ago, family-wide (for the confirmation dialog). */
  /** What deleting prints older than `months` would remove: how many, and their photo bytes. */
  countOld: (user: AuthenticatedUser, months: number) => Promise<{ count: number; bytes: number }>
  deleteOld: (user: AuthenticatedUser, months: number) => Promise<{ count: number }>
  getImage: (user: AuthenticatedUser, imageId: string) => Promise<StoredImage>
}

const logger = createLogger({ format: 'json' })

const JPEG_SIGNATURE = [0xff, 0xd8, 0xff]

const unique = (ids: string[]): string[] => [...new Set(ids)]

const totalSize = (images: { size: number }[]): number =>
  images.reduce((sum, image) => sum + image.size, 0)

/** Views leave out `familyId`: it's always the caller's own. */
const withoutFamily = <T extends { familyId: string }>(item: T): Omit<T, 'familyId'> => {
  const rest: Partial<T> = { ...item }
  delete rest.familyId
  return rest as Omit<T, 'familyId'>
}

export const createPrintService = (deps: {
  printRepository: PrintRepository
  childRepository: ChildRepository
  topicRepository: TopicRepository
  imageRepository: ImageRepository
}): PrintService => {
  const findPrint = async (user: AuthenticatedUser, id: string): Promise<Print> => {
    const print = await deps.printRepository.findInFamily(user.familyId, id)
    if (!print) throw new AppError('not_found')
    return print
  }

  /** The slot's name as history records it; `not_found` for a child outside the family. */
  const slotName = async (user: AuthenticatedUser, childId: string | null): Promise<string> => {
    if (childId === null) return COMMON_SLOT_NAME
    const child = await deps.childRepository.findInFamily(user.familyId, childId)
    if (!child) throw new AppError('not_found')
    return child.name
  }

  /** Topic id → name for the family; `topicNames` fails with `not_found` for a foreign id. */
  const loadTopicNames = async (user: AuthenticatedUser) => {
    const names = new Map(
      (await deps.topicRepository.listByFamily(user.familyId)).map((topic) => [
        topic.id,
        topic.name,
      ]),
    )
    return (ids: string[]): string[] =>
      ids.map((id) => {
        const name = names.get(id)
        if (name === undefined) throw new AppError('not_found')
        return name
      })
  }

  /** Reads the uploads, rejecting anything that isn't a JPEG by its first bytes. */
  const readJpegs = async (blobs: Blob[]): Promise<(PrintImage & { data: ArrayBuffer })[]> =>
    Promise.all(
      blobs.map(async (blob, index) => {
        const data = await blob.arrayBuffer()
        const head = new Uint8Array(data.slice(0, JPEG_SIGNATURE.length))
        if (!JPEG_SIGNATURE.every((byte, i) => head[i] === byte)) {
          throw new AppError('invalid_input', { field: 'images', page: index + 1 })
        }
        return { id: crypto.randomUUID(), page: index + 1, size: data.byteLength, data }
      }),
    )

  /** `storage_limit` if the family would exceed its quota after `added` bytes (minus `removed`). */
  const assertStorage = async (familyId: string, added: number, removed = 0): Promise<void> => {
    const used = await deps.printRepository.storageUsed(familyId)
    if (used - removed + added > LIMITS.familyStorageBytes) throw new AppError('storage_limit')
  }

  const refsOf = (printId: string, images: { id: string }[]): ImageRef[] =>
    images.map((image) => ({ printId, imageId: image.id }))

  /** R2 cleanup after the D1 write decided the outcome: failures are logged, not surfaced. */
  const deleteImagesQuietly = async (familyId: string, images: ImageRef[]): Promise<void> => {
    try {
      await deps.imageRepository.deleteImages(familyId, images)
    } catch (error) {
      logger.error('failed to delete images', {
        familyId,
        count: images.length,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const historyFields = (
    print: Pick<Print, 'title' | 'receivedOn' | 'dueOn' | 'responseStatus'>,
    topics: string[],
  ): PrintHistoryFields => ({
    title: print.title,
    topics,
    receivedOn: print.receivedOn,
    dueOn: print.dueOn,
    responseStatus: print.responseStatus,
  })

  return {
    list: async (user, filter) =>
      (
        await deps.printRepository.list({
          familyId: user.familyId,
          memberId: user.id,
          today: toJstDateString(new Date()),
          ...filter,
        })
      ).map(withoutFamily),

    detail: async (user, id) => {
      const print = await findPrint(user, id)
      await deps.printRepository.markViewed(id, user.id)
      const [topicIds, images, states] = await Promise.all([
        deps.printRepository.listTopicIds(id),
        deps.printRepository.listImages(id),
        deps.printRepository.listMiteneStates(id),
      ])
      const received = states.find((state) => state.memberId === user.id)
      return {
        ...withoutFamily(print),
        topicIds,
        images: images.map(({ id: imageId, page }) => ({ id: imageId, page })),
        isRead: true,
        miteneStatus: received?.status ?? 'none',
        miteneSent: states
          .filter((state) => state.fromMemberId === user.id)
          .map(({ memberId, memberName, status }) => ({ memberId, memberName, status })),
        miteneReceived: received
          ? {
              fromMemberId: received.fromMemberId,
              fromMemberName: received.fromMemberName,
              status: received.status,
            }
          : null,
      }
    },

    create: async (user, input) => {
      const topicIds = unique(input.topicIds)
      const [name, topicNames, images] = await Promise.all([
        slotName(user, input.childId),
        loadTopicNames(user),
        readJpegs(input.images),
      ])
      const topics = topicNames(topicIds)
      await assertStorage(user.familyId, totalSize(images))

      const now = Date.now()
      const print = {
        id: crypto.randomUUID(),
        familyId: user.familyId,
        childId: input.childId,
        title: input.title,
        receivedOn: input.receivedOn,
        dueOn: input.dueOn,
        responseStatus: input.responseStatus,
        createdAt: now,
      }
      const refs = refsOf(print.id, images)
      await deps.imageRepository.putImages(
        user.familyId,
        images.map((image, index) => ({ ...refs[index], data: image.data })),
      )
      try {
        const seq = await deps.printRepository.create(
          {
            print,
            images: images.map(({ id, page, size }) => ({ id, page, size })),
            topicIds,
            creatorId: user.id,
            history: {
              memberName: user.name,
              target: 'print',
              action: 'create',
              name,
              details: createdDetails(historyFields(print, topics)),
            },
          },
          now,
        )
        return { id: print.id, childId: print.childId, seq }
      } catch (error) {
        await deleteImagesQuietly(user.familyId, refs)
        throw error
      }
    },

    update: async (user, id, patch) => {
      const print = await findPrint(user, id)
      const [currentTopicIds, topicNames] = await Promise.all([
        deps.printRepository.listTopicIds(id),
        loadTopicNames(user),
      ])
      const nextTopicIds = patch.topicIds ? unique(patch.topicIds) : currentTopicIds
      const topicsChanged =
        nextTopicIds.length !== currentTopicIds.length ||
        nextTopicIds.some((topicId) => !currentTopicIds.includes(topicId))

      const changes: Partial<Pick<Print, 'title' | 'receivedOn' | 'dueOn' | 'responseStatus'>> = {}
      for (const key of ['title', 'receivedOn', 'dueOn', 'responseStatus'] as const) {
        if (patch[key] !== undefined && patch[key] !== print[key]) {
          Object.assign(changes, { [key]: patch[key] })
        }
      }
      const moveTo =
        patch.childId !== undefined && patch.childId !== print.childId ? patch.childId : undefined
      if (moveTo === undefined && !topicsChanged && Object.keys(changes).length === 0) {
        return { id, childId: print.childId, seq: print.seq }
      }

      const before = historyFields(print, topicNames(currentTopicIds))
      const after = historyFields({ ...print, ...changes }, topicNames(nextTopicIds))
      const fromName = await slotName(user, print.childId)
      const base = { memberName: user.name, target: 'print' as const }
      const histories =
        moveTo === undefined
          ? [
              {
                ...base,
                action: 'update' as const,
                name: fromName,
                printSeq: print.seq,
                details: updatedDetails(before, after),
              },
            ]
          : // Moving is recorded as deleting the print from the old slot and registering it in
            // the new one, under the new slot's sequence number (spec "こどもの付け替え").
            [
              { ...base, action: 'delete' as const, name: fromName, printSeq: print.seq },
              {
                ...base,
                action: 'create' as const,
                name: await slotName(user, moveTo),
                details: createdDetails(after),
              },
            ]

      const seq = await deps.printRepository.update(
        {
          print,
          changes,
          topicIds: topicsChanged ? nextTopicIds : undefined,
          move: moveTo === undefined ? undefined : { childId: moveTo },
          histories,
        },
        Date.now(),
      )
      return { id, childId: moveTo === undefined ? print.childId : moveTo, seq }
    },

    replaceImages: async (user, id, blobs) => {
      const print = await findPrint(user, id)
      const [images, oldImages, name] = await Promise.all([
        readJpegs(blobs),
        deps.printRepository.listImages(id),
        slotName(user, print.childId),
      ])
      await assertStorage(user.familyId, totalSize(images), totalSize(oldImages))

      const refs = refsOf(id, images)
      await deps.imageRepository.putImages(
        user.familyId,
        images.map((image, index) => ({ ...refs[index], data: image.data })),
      )
      try {
        await deps.printRepository.replaceImages(
          print,
          images.map(({ id: imageId, page, size }) => ({ id: imageId, page, size })),
          {
            memberName: user.name,
            target: 'print',
            action: 'update',
            name,
            printSeq: print.seq,
            details: { image_count: images.length },
          },
          Date.now(),
        )
      } catch (error) {
        await deleteImagesQuietly(user.familyId, refs)
        throw error
      }
      await deleteImagesQuietly(user.familyId, refsOf(id, oldImages))
      return { images: images.map(({ id: imageId, page }) => ({ id: imageId, page })) }
    },

    delete: async (user, id) => {
      const print = await findPrint(user, id)
      const [images, name] = await Promise.all([
        deps.printRepository.listImages(id),
        slotName(user, print.childId),
      ])
      await deps.printRepository.delete(
        print,
        { memberName: user.name, target: 'print', action: 'delete', name, printSeq: print.seq },
        Date.now(),
      )
      await deleteImagesQuietly(user.familyId, refsOf(id, images))
    },

    countOld: async (user, months) => {
      const cutoff = addJstMonths(new Date(), -months).getTime()
      const [count, bytes] = await Promise.all([
        deps.printRepository.countCreatedBy(user.familyId, cutoff),
        deps.printRepository.imageBytesCreatedBy(user.familyId, cutoff),
      ])
      return { count, bytes }
    },

    deleteOld: async (user, months) => {
      const now = Date.now()
      const cutoff = addJstMonths(new Date(now), -months).getTime()
      // Read before the delete, like deleting a child: a print registered in between can't be
      // older than the cutoff, so the count and photos can't miss one.
      const [count, images] = await Promise.all([
        deps.printRepository.countCreatedBy(user.familyId, cutoff),
        deps.printRepository.listImagesCreatedBy(user.familyId, cutoff),
      ])
      if (count === 0) return { count }

      await deps.printRepository.deleteCreatedBy(
        user.familyId,
        cutoff,
        {
          memberName: user.name,
          target: 'print',
          action: 'bulk_delete',
          details: { older_than_months: months, print_count: count },
        },
        now,
      )
      await deleteImagesQuietly(user.familyId, images)
      return { count }
    },

    getImage: async (user, imageId) => {
      const ref = await deps.printRepository.findImageInFamily(user.familyId, imageId)
      const image = ref ? await deps.imageRepository.getImage(user.familyId, ref) : null
      if (!image) throw new AppError('not_found')
      return image
    },
  }
}
