import { expect, test } from 'vite-plus/test'

import { inviteTokenFromQuery, inviteTokenFromScan, inviteUrl } from './invite.ts'

const origin = 'https://app.example.com'

test('inviteUrl puts the token in the join URL query', () => {
  expect(inviteUrl(origin, 'abc.def-_')).toBe('https://app.example.com/join?invite=abc.def-_')
})

test('inviteTokenFromQuery reads the token, ignoring a missing or empty one', () => {
  expect(inviteTokenFromQuery({ invite: 'abc' })).toBe('abc')
  expect(inviteTokenFromQuery({})).toBeNull()
  expect(inviteTokenFromQuery({ invite: '' })).toBeNull()
  expect(inviteTokenFromQuery({ invite: ['a', 'b'] })).toBeNull()
})

test('inviteTokenFromScan reads the token back from the invite URL', () => {
  expect(inviteTokenFromScan(inviteUrl(origin, 'abc'), origin)).toBe('abc')
})

test("inviteTokenFromScan refuses anything but this app's invite URL", () => {
  expect(inviteTokenFromScan('abc', origin)).toBeNull()
  expect(inviteTokenFromScan('https://evil.example/join?invite=abc', origin)).toBeNull()
  expect(inviteTokenFromScan('https://app.example.com/other?invite=abc', origin)).toBeNull()
  expect(inviteTokenFromScan('https://app.example.com/join', origin)).toBeNull()
})
