import { expect, test, vi } from 'vite-plus/test'

import type { Member } from '../repository/member.repository.ts'
import type { Print, PrintRepository } from '../repository/print.repository.ts'
import { fakeMemberRepository, invitedUser } from '../testing.ts'
import { createMiteneService } from './mitene.service.ts'

const member = (id: string, isOwner = false): Member => ({
  id,
  familyId: 'f1',
  name: id,
  isOwner,
  termsVersion: 'v1',
})

const print = { id: 'p1', familyId: 'f1' } as Print

const createService = () => {
  const printRepository = {
    findInFamily: vi.fn<PrintRepository['findInFamily']>(async (_familyId, id) =>
      id === 'p1' ? print : null,
    ),
    requestMitene: vi.fn<PrintRepository['requestMitene']>(async () => {}),
  }
  const service = createMiteneService({
    printRepository: printRepository as unknown as PrintRepository,
    memberRepository: fakeMemberRepository({
      listByFamily: async () => [member('owner', true), member(invitedUser.id), member('m3')],
    }),
  })
  return { service, printRepository }
}

test('send requests mitene from the caller to each recipient, once each', async () => {
  const { service, printRepository } = createService()

  await service.send(invitedUser, 'p1', ['owner', 'm3', 'owner'])

  expect(printRepository.requestMitene).toHaveBeenCalledWith('p1', invitedUser.id, ['owner', 'm3'])
})

test('send refuses sending to oneself', async () => {
  const { service, printRepository } = createService()

  await expect(service.send(invitedUser, 'p1', ['owner', invitedUser.id])).rejects.toMatchObject({
    code: 'invalid_input',
  })
  expect(printRepository.requestMitene).not.toHaveBeenCalled()
})

test('send answers not_found for a print or recipient outside the family', async () => {
  const { service, printRepository } = createService()

  await expect(service.send(invitedUser, 'other', ['owner'])).rejects.toMatchObject({
    code: 'not_found',
  })
  await expect(service.send(invitedUser, 'p1', ['owner', 'stranger'])).rejects.toMatchObject({
    code: 'not_found',
  })
  expect(printRepository.requestMitene).not.toHaveBeenCalled()
})
