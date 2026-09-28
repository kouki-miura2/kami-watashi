import type { FamilyDao } from '../dao/family.interface.ts'

export interface NewFamilyWithOwner {
  familyId: string
  owner: { id: string; name: string; googleSub: string }
  termsVersion: string
  now: number
}

export interface FamilyRepository {
  createWithOwner: (input: NewFamilyWithOwner) => Promise<void>
  touch: (familyId: string, now: number) => Promise<void>
  listInactive: (before: number, limit: number) => Promise<string[]>
  delete: (familyId: string) => Promise<void>
}

export const createFamilyRepository = (dao: FamilyDao): FamilyRepository => ({
  createWithOwner: async ({ familyId, owner, termsVersion, now }) =>
    dao.createWithOwner({
      familyId,
      ownerId: owner.id,
      ownerName: owner.name,
      googleSub: owner.googleSub,
      termsVersion,
      now,
    }),
  touch: async (familyId, now) => dao.touch(familyId, now),
  listInactive: async (before, limit) => dao.listInactive(before, limit),
  delete: async (familyId) => dao.delete(familyId),
})
