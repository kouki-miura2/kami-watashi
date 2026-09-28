import type { AuthenticatedUser } from '../repository/auth-guard.interface.ts'
import type { Topic, TopicRepository } from '../repository/topic.repository.ts'
import { AppError, assertNameAvailable, withNameTaken } from './errors.ts'

export interface TopicView {
  id: string
  name: string
}

export interface TopicService {
  /** By name. */
  list: (user: AuthenticatedUser) => Promise<TopicView[]>
  create: (user: AuthenticatedUser, name: string) => Promise<TopicView>
  rename: (user: AuthenticatedUser, id: string, name: string) => Promise<TopicView>
  /** Deletes the topic; it comes off every print. */
  delete: (user: AuthenticatedUser, id: string) => Promise<void>
}

export const createTopicService = (deps: { topicRepository: TopicRepository }): TopicService => {
  const findTopic = async (user: AuthenticatedUser, id: string): Promise<Topic> => {
    const topic = await deps.topicRepository.findInFamily(user.familyId, id)
    if (!topic) throw new AppError('not_found')
    return topic
  }

  return {
    list: async (user) =>
      (await deps.topicRepository.listByFamily(user.familyId))
        .toSorted((a, b) => a.name.localeCompare(b.name, 'ja'))
        .map(({ id, name }) => ({ id, name })),

    create: async (user, name) => {
      assertNameAvailable(await deps.topicRepository.listByFamily(user.familyId), name)
      const topic = { id: crypto.randomUUID(), familyId: user.familyId, name }
      await withNameTaken(
        deps.topicRepository.create(
          topic,
          { memberName: user.name, target: 'topic', action: 'create', name },
          Date.now(),
        ),
      )
      return { id: topic.id, name }
    },

    rename: async (user, id, name) => {
      const topic = await findTopic(user, id)
      if (name === topic.name) return { id, name }

      assertNameAvailable(await deps.topicRepository.listByFamily(user.familyId), name, id)
      await withNameTaken(
        deps.topicRepository.rename(
          topic,
          name,
          {
            memberName: user.name,
            target: 'topic',
            action: 'update',
            name: topic.name,
            newName: name,
          },
          Date.now(),
        ),
      )
      return { id, name }
    },

    delete: async (user, id) => {
      const topic = await findTopic(user, id)
      await deps.topicRepository.delete(
        topic,
        { memberName: user.name, target: 'topic', action: 'delete', name: topic.name },
        Date.now(),
      )
    },
  }
}
