import { test } from 'node:test'
import assert from 'node:assert/strict'
import { maakHandtekening, bepaalPosities, isTeOudVoorMelding, maakKlassement, maakKlassementRegel, maakVoorspellingen, maakVoorspellingenRegel, maakBerichtGegevens } from './_notificaties.js'

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

test('maakKlassement: aflopend op punten, met naam en gedeelde plaatsen', () => {
  const namen = { a: 'Huub', b: 'Niek', c: 'Sam' }
  const lijst = maakKlassement({ a: 42, b: 48, c: 42 }, namen)
  assert.deepEqual(lijst.map(r => [r.positie, r.naam, r.punten]), [
    [1, 'Niek', 48],
    [2, 'Huub', 42],
    [2, 'Sam', 42],
  ])
})

test('maakKlassement: onbekende speler valt terug op ???', () => {
  const lijst = maakKlassement({ x: 5 }, {})
  assert.equal(lijst[0].naam, '???')
})

test('maakKlassementRegel: één regel zonder regeleindes, spelers gescheiden door een punt', () => {
  const regel = maakKlassementRegel({ a: 42, b: 48 }, { a: 'Huub', b: 'Niek' })
  assert.equal(regel, '1. Niek 48 · 2. Huub 42')
  // WhatsApp weigert sjabloonvariabelen met een regeleinde of tab.
  assert.ok(!/[\n\r\t]/.test(regel))
})

test('maakKlassementRegel: leeg klassement levert een lege regel', () => {
  assert.equal(maakKlassementRegel({}, {}), '')
  assert.equal(maakKlassementRegel(null, {}), '')
})

const RESULT = {
  thuis: 'PSV', uit: 'AJA',
  datum: 'za 1 nov 2026',
  uitslag: { home: 2, away: 1 },
  predicties: { a: { home: 2, away: 1 }, b: { home: 1, away: 1 }, c: null },
  punten: { a: 10, b: 0, c: 0 },
  totalen: { a: 48, b: 38, c: 12 },
}
const NAMEN = { a: 'Huub', b: 'Niek', c: 'Sam' }

test('maakVoorspellingen: alle deelnemers, beste voorspelling bovenaan', () => {
  const lijst = maakVoorspellingen(RESULT, NAMEN)
  assert.equal(lijst.length, 3)
  assert.deepEqual(lijst.map(r => [r.naam, r.voorspelling, r.punten]), [
    ['Huub', '2-1', 10],
    ['Niek', '1-1', 0],
    ['Sam', 'geen voorspelling', 0],
  ])
})

test('maakVoorspellingenRegel: één regel zonder regeleindes', () => {
  const regel = maakVoorspellingenRegel(RESULT, NAMEN)
  assert.equal(regel, 'Huub 2-1 (10 pt) · Niek 1-1 (0 pt) · Sam geen voorspelling (0 pt)')
  assert.ok(!/[\n\r\t]/.test(regel))
})

test('maakBerichtGegevens: bevat alle deelnemers en het hele klassement', () => {
  const g = maakBerichtGegevens(RESULT, { id: 'a', naam: 'Huub' }, { naamPerSpeler: NAMEN })
  assert.equal(g.eindstand, '2-1')
  assert.equal(g.wedstrijd, 'PSV Eindhoven – Ajax')
  assert.equal(g.voorspellingen.length, 3)
  assert.equal(g.klassement.length, 3)
  assert.equal(g.playerId, 'a')
  assert.equal(g.isCorrectie, false)
})

test('maakBerichtGegevens: markeert een gecorrigeerde uitslag in de titel', () => {
  const g = maakBerichtGegevens(RESULT, { id: 'a', naam: 'Huub' }, { naamPerSpeler: NAMEN, isCorrectie: true })
  assert.ok(g.wedstrijd.includes('(gecorrigeerd)'))
  assert.equal(g.isCorrectie, true)
})
