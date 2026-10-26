import { test } from 'node:test'
import assert from 'node:assert/strict'
import { maakTrend, totaalWedstrijden, asStappen } from './trend.js'

const RESULTATEN = [
  { volgnummer: 2, datum: 'di 20 okt', totalen: { huub: 48, niek: 42 } },
  { volgnummer: 1, datum: 'za 17 okt', totalen: { huub: 43, niek: 42 } },
  { volgnummer: 3, datum: 'zo 25 okt', totalen: { huub: 50, niek: 44 } },
]

const FIXTURES = [
  { volgnummer: 1 }, { volgnummer: 2 }, { volgnummer: 3 },
  { volgnummer: 4 }, { volgnummer: 5 },
]

test('maakTrend: op volgnummer gesorteerd, beginnend bij nul', () => {
  const trend = maakTrend(RESULTATEN, FIXTURES, { huub: 'Huub', niek: 'Niek' })
  const huub = trend.reeksen.find(r => r.playerId === 'huub')
  assert.deepEqual(huub.punten, [
    { nr: 0, totaal: 0 },
    { nr: 1, totaal: 43 },
    { nr: 2, totaal: 48 },
    { nr: 3, totaal: 50 },
  ])
  assert.equal(huub.naam, 'Huub')
  assert.equal(huub.eind, 50)
})

test('maakTrend: laatst gespeelde en totaal aantal wedstrijden', () => {
  const trend = maakTrend(RESULTATEN, FIXTURES, {})
  assert.equal(trend.laatstGespeeld, 3)
  assert.equal(trend.totaal, 5)
  assert.equal(trend.maxPunten, 50)
})

test('maakTrend: een later toegevoegde speler blijft op zijn vorige stand', () => {
  const laat = [
    { volgnummer: 1, totalen: { huub: 5 } },
    { volgnummer: 2, totalen: { huub: 9, niek: 3 } },
  ]
  const trend = maakTrend(laat, FIXTURES, { huub: 'Huub', niek: 'Niek' })
  const niek = trend.reeksen.find(r => r.playerId === 'niek')
  // Geen gat in de lijn: tot zijn eerste wedstrijd staat hij gewoon op nul.
  assert.deepEqual(niek.punten, [
    { nr: 0, totaal: 0 },
    { nr: 1, totaal: 0 },
    { nr: 2, totaal: 3 },
  ])
})

test('maakTrend: zonder resultaten een lege maar bruikbare uitkomst', () => {
  const trend = maakTrend([], FIXTURES, {})
  assert.deepEqual(trend.reeksen, [])
  assert.equal(trend.laatstGespeeld, 0)
  assert.equal(trend.totaal, 5)
  assert.equal(trend.maxPunten, 0)
})

test('maakTrend: zonder volgnummer telt de volgorde van de lijst', () => {
  const zonder = [
    { datum: 'eerste', totalen: { huub: 3 } },
    { datum: 'tweede', totalen: { huub: 8 } },
  ]
  const trend = maakTrend(zonder, [], { huub: 'Huub' })
  assert.deepEqual(trend.reeksen[0].punten.map(p => p.nr), [0, 1, 2])
})

test('totaalWedstrijden: het hoogste nummer telt, agenda of resultaten', () => {
  assert.equal(totaalWedstrijden(FIXTURES, RESULTATEN), 5)
  // Een gespeelde wedstrijd die (nog) niet in de agenda staat telt ook mee.
  assert.equal(totaalWedstrijden([{ volgnummer: 2 }], [{ volgnummer: 7 }]), 7)
  assert.equal(totaalWedstrijden([], []), 0)
})

test('asStappen: ronde stappen tot net boven de hoogste stand', () => {
  assert.deepEqual(asStappen(50).stappen, [0, 20, 40, 60])
  assert.deepEqual(asStappen(8).stappen, [0, 2, 4, 6, 8])
  // Ook zonder punten blijft er een bruikbare as over.
  assert.equal(asStappen(0).stappen[0], 0)
  assert.ok(asStappen(0).top > 0)
})
