import { test } from 'node:test'
import assert from 'node:assert/strict'
import { maakHandtekening, bepaalPosities, isTeOudVoorMelding } from './_notificaties.js'

test('maakHandtekening: zelfde uitslag en punten geeft dezelfde vingerafdruk, ongeacht sleutelvolgorde', () => {
  const a = maakHandtekening({ uitslag: { home: 2, away: 1 }, punten: { p1: 10, p2: 0 } })
  const b = maakHandtekening({ uitslag: { home: 2, away: 1 }, punten: { p2: 0, p1: 10 } })
  assert.equal(a, b)
})

test('maakHandtekening: gewijzigde punten of uitslag geeft een andere vingerafdruk', () => {
  const basis = maakHandtekening({ uitslag: { home: 2, away: 1 }, punten: { p1: 10 } })
  const anderePunten = maakHandtekening({ uitslag: { home: 2, away: 1 }, punten: { p1: 7 } })
  const andereUitslag = maakHandtekening({ uitslag: { home: 3, away: 1 }, punten: { p1: 10 } })
  assert.notEqual(basis, anderePunten)
  assert.notEqual(basis, andereUitslag)
})

test('bepaalPosities: sorteert aflopend en deelt gelijke standen dezelfde plaats', () => {
  // 43, 42, 42, 10 -> plaatsen 1, 2, 2, 4
  const posities = bepaalPosities({ a: 42, b: 43, c: 42, d: 10 })
  assert.equal(posities.b, 1)
  assert.equal(posities.a, 2)
  assert.equal(posities.c, 2)
  assert.equal(posities.d, 4)
})

test('bepaalPosities: lege of ontbrekende totalen leveren een leeg resultaat', () => {
  assert.deepEqual(bepaalPosities({}), {})
  assert.deepEqual(bepaalPosities(null), {})
})

test('isTeOudVoorMelding: verse uitslag mag melden, oude niet', () => {
  const nu = new Date('2026-10-21T08:00:00Z').getTime()
  const gisteravond = '2026-10-20T19:00:00Z'
  const weekGeleden = '2026-10-14T19:00:00Z'
  assert.equal(isTeOudVoorMelding(gisteravond, nu), false)
  assert.equal(isTeOudVoorMelding(weekGeleden, nu), true)
})

test('isTeOudVoorMelding: zonder datum nooit als te oud bestempelen', () => {
  assert.equal(isTeOudVoorMelding(null), false)
  assert.equal(isTeOudVoorMelding(undefined), false)
})
