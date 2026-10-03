import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { LIMITS, charLength } from 'utils'
import { z } from 'zod'

import type { MiteneService } from '../service/mitene.service.ts'
import type { PrintService } from '../service/print.service.ts'
import { type AppEnv, currentUser, invalidInput } from './context.ts'
import { createDataVersionCache } from './data-version-cache.ts'

/** Query/form token for the family-common slot (JSON bodies use `null`). */
const COMMON_SLOT = 'common'

const slotSchema = z
  .string()
  .min(1)
  .transform((value) => (value === COMMON_SLOT ? null : value))

const dateSchema = z.iso.date()

/** A title; blank clears it. */
const titleSchema = z
  .string()
  .trim()
  .refine((value) => charLength(value) <= LIMITS.titleMaxLength, {
    message: `At most ${LIMITS.titleMaxLength} characters`,
  })
  .transform((value) => value || null)

/** A form field that may be absent or blank (→ null). */
const optionalFormDate = z
  .union([z.literal(''), dateSchema])
  .optional()
  .transform((value) => value || null)

const responseStatusSchema = z.enum(['none', 'todo', 'done'])

/** A repeated form field: absent, one value, or several all become an array. */
const formArray = <T extends z.ZodType>(item: T) =>
  z.preprocess(
    (value) => (value === undefined ? [] : Array.isArray(value) ? value : [value]),
    z.array(item),
  )

const imagesSchema = formArray(z.file().mime(['image/webp', 'image/jpeg'])).pipe(
  z.array(z.file()).min(1).max(LIMITS.printImages),
)

const topicIdsSchema = z.array(z.string().min(1)).max(LIMITS.printTopics)

const olderThanMonthsSchema = z.coerce
  .number()
  .refine((months) => (LIMITS.bulkDeleteMonths as readonly number[]).includes(months), {
    message: `One of ${LIMITS.bulkDeleteMonths.join(', ')}`,
  })

export const createPrintsRoutes = (deps: {
  printService: PrintService
  miteneService: MiteneService
  config: { deploymentId: string }
}) =>
  new Hono<AppEnv>()
    .get(
      '/',
      createDataVersionCache(deps.config),
      zValidator(
        'query',
        z.object({
          child: slotSchema,
          sort: z.enum(['created', 'due']).default('created'),
          /** Comma-separated; prints having all of them. */
          topicIds: z
            .string()
            .optional()
            .transform((value) => (value ? value.split(',').filter(Boolean) : [])),
          read: z
            .enum(['unread', 'read'])
            .optional()
            .transform((value) => (value === undefined ? undefined : value === 'read')),
          response: responseStatusSchema.optional(),
          mitene: z.enum(['none', 'requested', 'seen']).optional(),
        }),
        invalidInput,
      ),
      async (c) => {
        const query = c.req.valid('query')
        return c.json(
          await deps.printService.list(currentUser(c), {
            childId: query.child,
            sort: query.sort,
            topicIds: query.topicIds,
            read: query.read,
            responseStatus: query.response,
            miteneStatus: query.mitene,
          }),
        )
      },
    )
    // Registered before `/:id` so it isn't taken for a print id.
    .get(
      '/bulk-delete',
      zValidator('query', z.object({ olderThanMonths: olderThanMonthsSchema }), invalidInput),
      async (c) =>
        c.json(
          await deps.printService.countOld(currentUser(c), c.req.valid('query').olderThanMonths),
        ),
    )
    .post(
      '/bulk-delete',
      zValidator('json', z.object({ olderThanMonths: olderThanMonthsSchema }), invalidInput),
      async (c) =>
        c.json(
          await deps.printService.deleteOld(currentUser(c), c.req.valid('json').olderThanMonths),
        ),
    )
    .post(
      '/',
      zValidator(
        'form',
        z.object({
          /** A child id, or `common`. */
          childId: slotSchema,
          title: titleSchema.optional().transform((value) => value ?? null),
          receivedOn: optionalFormDate,
          dueOn: optionalFormDate,
          topicIds: formArray(z.string().min(1)).pipe(topicIdsSchema),
          responseStatus: responseStatusSchema.default('none'),
          /** WebP (or JPEG) photos in page order (repeat the field). */
          images: imagesSchema,
        }),
        invalidInput,
      ),
      async (c) => c.json(await deps.printService.create(currentUser(c), c.req.valid('form')), 201),
    )
    .get('/:id', async (c) =>
      c.json(await deps.printService.detail(currentUser(c), c.req.param('id'))),
    )
    .patch(
      '/:id',
      zValidator(
        'json',
        z.object({
          /** Moves the print; `null` is the family-common slot. */
          childId: z.string().min(1).nullable().optional(),
          title: titleSchema.nullable().optional(),
          receivedOn: dateSchema.nullable().optional(),
          dueOn: dateSchema.nullable().optional(),
          topicIds: topicIdsSchema.optional(),
          responseStatus: responseStatusSchema.optional(),
        }),
        invalidInput,
      ),
      async (c) =>
        c.json(
          await deps.printService.update(currentUser(c), c.req.param('id'), c.req.valid('json')),
        ),
    )
    .put(
      '/:id/images',
      zValidator('form', z.object({ images: imagesSchema }), invalidInput),
      async (c) =>
        c.json(
          await deps.printService.replaceImages(
            currentUser(c),
            c.req.param('id'),
            c.req.valid('form').images,
          ),
        ),
    )
    .delete('/:id', async (c) => {
      await deps.printService.delete(currentUser(c), c.req.param('id'))
      return c.body(null, 204)
    })
    .post(
      '/:id/mitene',
      zValidator('json', z.object({ memberIds: z.array(z.string().min(1)).min(1) }), invalidInput),
      async (c) => {
        await deps.miteneService.send(
          currentUser(c),
          c.req.param('id'),
          c.req.valid('json').memberIds,
        )
        return c.body(null, 204)
      },
    )
