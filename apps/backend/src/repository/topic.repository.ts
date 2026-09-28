import type { TopicDao, TopicRecord } from '../dao/topic.interface.ts'
import { type HistoryEntry, toHistoryRecord } from './history.repository.ts'

export interface Topic {
  id: string
  familyId: string
  name: string
}

export interface TopicRepository {
  listByFamily: (familyId: string) => Promise<Topic[]>
  /** The family's topics with the number of prints each is set on. */
  listWithPrintCounts: (familyId: string) => Promise<(Topic & { printCount: number })[]>
  findInFamily: (familyId: string, id: string) => Promise<Topic | null>
  /** Throws `UniqueConstraintError` if the name is taken. */
  create: (topic: Topic, history: HistoryEntry, now: number) => Promise<void>
  /** Throws `UniqueConstraintError` if the name is taken. */
  rename: (topic: Topic, name: string, history: HistoryEntry, now: number) => Promise<void>
  delete: (topic: Topic, history: HistoryEntry, now: number) => Promise<void>
}

const toTopic = (record: TopicRecord): Topic => ({
  id: record.id,
  familyId: record.family_id,
  name: record.name,
})

export const createTopicRepository = (dao: TopicDao): TopicRepository => ({
  listByFamily: async (familyId) => (await dao.listByFamily(familyId)).map(toTopic),
  listWithPrintCounts: async (familyId) =>
    (await dao.listWithPrintCounts(familyId)).map((record) => ({
      ...toTopic(record),
      printCount: record.print_count,
    })),
  findInFamily: async (familyId, id) => {
    const record = await dao.findInFamily(familyId, id)
    return record ? toTopic(record) : null
  },
  create: async (topic, history, now) =>
    dao.create(
      { id: topic.id, family_id: topic.familyId, name: topic.name },
      toHistoryRecord(topic.familyId, history, now),
    ),
  rename: async (topic, name, history, now) =>
    dao.rename(topic.id, name, toHistoryRecord(topic.familyId, history, now)),
  delete: async (topic, history, now) =>
    dao.delete(topic.id, toHistoryRecord(topic.familyId, history, now)),
})
