import { test } from 'node:test'
import assert from 'node:assert/strict'
import { berekenPunten, totoLabel } from './_scoring.js'

// Puntenregels: juiste toto (1/X/2) = 5, exact juiste score = nog eens 5,
// precies één juist scoregetal (thuis óf uit) = 2.

test('berekenPunten: exact juiste uitslag levert 10 (toto + volledige score)', () => {
  assert.equal(berekenPunten({ home: 2, away: 1 }, { home: 2, away: 1 }), 10)
})

test('berekenPunten: juiste toto + één juist getal levert 7', () => {
  // 2-1 en 2-0 zijn beide thuiswinst (toto goed = 5), thuisgetal klopt (=2)
  assert.equal(berekenPunten({ home: 2, away: 1 }, { home: 2, away: 0 }), 7)
})

test('berekenPunten: alleen juiste toto levert 5', () => {
  // 3-1 en 2-0 beide thuiswinst; geen enkel getal klopt
  assert.equal(berekenPunten({ home: 3, away: 1 }, { home: 2, away: 0 }), 5)
})

test('berekenPunten: verkeerde toto maar één juist getal levert 2', () => {
  // 2-1 (thuiswinst) vs 2-3 (uitwinst): toto fout, thuisgetal klopt (=2)
  assert.equal(berekenPunten({ home: 2, away: 1 }, { home: 2, away: 3 }), 2)
})

test('berekenPunten: volledig mis levert 0', () => {
  assert.equal(berekenPunten({ home: 1, away: 0 }, { home: 0, away: 3 }), 0)
})

test('berekenPunten: gelijkspel-toto en exact gelijkspel', () => {
  assert.equal(berekenPunten({ home: 1, away: 1 }, { home: 2, away: 2 }), 5)
  assert.equal(berekenPunten({ home: 1, away: 1 }, { home: 1, away: 1 }), 10)
})

test('berekenPunten: ontbrekende invoer levert 0', () => {
  assert.equal(berekenPunten(null, { home: 1, away: 0 }), 0)
  assert.equal(berekenPunten({ home: 1, away: 0 }, null), 0)
})

test('totoLabel: 1 bij thuiswinst, 2 bij uitwinst, X bij gelijk', () => {
  assert.equal(totoLabel({ home: 2, away: 0 }), '1')
  assert.equal(totoLabel({ home: 0, away: 2 }), '2')
  assert.equal(totoLabel({ home: 1, away: 1 }), 'X')
})

test('totoLabel: null zonder voorspelling', () => {
  assert.equal(totoLabel(null), null)
})
