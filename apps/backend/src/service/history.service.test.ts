import { LIMITS } from 'utils'
import { expect, test, vi } from 'vite-plus/test'

import type { History, HistoryRepository } from '../repository/history.repository.ts'
import { invitedUser } from '../testing.ts'
import { createHistoryService } from './history.service.ts'

const history = (n: number): History => ({
  id: `h${n}`,
  memberName: '一郎',
  target: 'child',
  action: 'create',
  name: `name${n}`,
  newName: null,
  printSeq: null,
  details: null,
  createdAt: 10_000 - n,
  position: { createdAt: 10_000 - n, rowid: 500 - n },
})

const createService = (rows: History[]) => {
  const listPage = vi.fn<HistoryRepository['listPage']>(async () => rows)
  return { service: createHistoryService({ historyRepository: { listPage } }), listPage }
}

test('the first page asks for one extra row and hands out a cursor when there is more', async () => {
  const rows = Array.from({ length: LIMITS.historyPageSize + 1 }, (_, n) => history(n))
  const { service, listPage } = createService(rows)

  const page = await service.list(invitedUser)

  expect(listPage).toHaveBeenCalledWith('f1', null, LIMITS.historyPageSize + 1)
  expect(page.items).toHaveLength(LIMITS.historyPageSize)
  expect(page.items[0]).toEqual({
    id: 'h0',
    memberName: '一郎',
    target: 'child',
    action: 'create',
    name: 'name0',
    newName: null,
    printSeq: null,
    details: null,
    createdAt: 10_000,
  })
  const last = rows[LIMITS.historyPageSize - 1].position
  expect(page.nextCursor).toBe(`${last.createdAt}.${last.rowid}`)
})

test('the last page has no cursor', async () => {
  const { service } = createService([history(0), history(1)])

  expect((await service.list(invitedUser)).nextCursor).toBeNull()
})

test('a cursor continues after that position', async () => {
  const { service, listPage } = createService([])

  await service.list(invitedUser, '9950.450')

  expect(listPage).toHaveBeenCalledWith(
    'f1',
    { createdAt: 9950, rowid: 450 },
    LIMITS.historyPageSize + 1,
  )
})

test('a malformed cursor is invalid input', async () => {
  const { service } = createService([])

  await expect(service.list(invitedUser, 'garbage')).rejects.toMatchObject({
    code: 'invalid_input',
  })
})
