import { expect, test, vi } from 'vite-plus/test'

import type { MemberService } from '../service/member.service.ts'
import { authorized, createTestApp, invitedUser, ownerUser } from '../testing.ts'

test('GET /members lists the caller’s family members', async () => {
  const members = [
    { id: 'owner', name: '一郎', isOwner: true, isMe: false },
    { id: 'invited', name: '二郎', isOwner: false, isMe: true },
  ]
  const listMembers = vi.fn<MemberService['listMembers']>(async () => members)
  const app = createTestApp({ user: invitedUser, services: { memberService: { listMembers } } })

  const res = await app.request('/members', authorized)

  expect(res.status).toBe(200)
  expect(await res.json()).toEqual(members)
  expect(listMembers).toHaveBeenCalledWith(invitedUser)
})

test('DELETE /members/:id lets the owner remove a member', async () => {
  const removeMember = vi.fn<MemberService['removeMember']>(async () => {})
  const app = createTestApp({ services: { memberService: { removeMember } } })

  const res = await app.request('/members/invited', { method: 'DELETE', ...authorized })

  expect(res.status).toBe(204)
  expect(removeMember).toHaveBeenCalledWith(ownerUser, 'invited')
})

test('DELETE /members/:id is owner-only', async () => {
  const removeMember = vi.fn<MemberService['removeMember']>(async () => {})
  const app = createTestApp({ user: invitedUser, services: { memberService: { removeMember } } })

  const res = await app.request('/members/owner', { method: 'DELETE', ...authorized })

  expect(res.status).toBe(403)
  expect(removeMember).not.toHaveBeenCalled()
})
