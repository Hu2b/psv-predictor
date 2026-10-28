import { test } from 'node:test'
import assert from 'node:assert/strict'
import { uitslagVoor, nederlagen, volgendeVan, gemiddeldeVerlieskans, maakVloek } from './vloek.js'

const w = (datum, thuis, uit, home, away, extra = {}) => ({
  datumISO: `${datum}T18:45:00Z`,
  datum,
  competitie: 'ERE',
  thuis, uit, home, away,
  thuisNaam: thuis, uitNaam: uit,
  gespeeld: true,
  winnaar: home > away ? 'HOME' : away > home ? 'AWAY' : 'DRAW',
  ...extra,
})

test('uitslagVoor: winst, gelijk en verlies vanuit één club', () => {
  const m = w('2026-10-17', 'ADO', 'PSV', 2, 1)
  assert.equal(uitslagVoor(m, 'ADO'), 'W')
  assert.equal(uitslagVoor(m, 'PSV'), 'V')
  assert.equal(uitslagVoor(w('2026-10-25', 'PSV', 'FEY', 1, 1), 'PSV'), 'G')
  // Een club die niet meespeelt levert niets op.
  assert.equal(uitslagVoor(m, 'AJA'), null)
})

test('uitslagVoor: een nog te spelen wedstrijd heeft geen uitslag', () => {
  const m = w('2026-11-01', 'PSV', 'AJA', null, null, { gespeeld: false, winnaar: null })
  assert.equal(uitslagVoor(m, 'PSV'), null)
})

test('nederlagen: alleen wedstrijden die PSV verloor, oudste eerst', () => {
  const lijst = [
    w('2026-10-25', 'PSV', 'FEY', 1, 1),
    w('2026-10-17', 'ADO', 'PSV', 2, 1),
    w('2026-09-12', 'PSV', 'AZ', 0, 3),
    w('2026-09-20', 'TWE', 'PSV', 0, 2),
  ]
  assert.deepEqual(nederlagen(lijst).map(m => m.datum), ['2026-09-12', '2026-10-17'])
})

test('nederlagen: verlies na strafschoppen telt gewoon mee', () => {
  const beker = w('2026-12-16', 'GRO', 'PSV', 1, 1, {
    competitie: 'KNVB', winnaar: 'HOME', naStrafschoppen: true,
  })
  assert.deepEqual(nederlagen([beker]).map(m => m.datum), ['2026-12-16'])
})

test('volgendeVan: de eerstvolgende wedstrijden van die club, in beide rollen', () => {
  const lijst = [
    w('2026-10-17', 'ADO', 'PSV', 2, 1),
    w('2026-10-21', 'AJA', 'ADO', 3, 0),   // ADO uit
    w('2026-10-26', 'ADO', 'TWE', 1, 1),   // ADO thuis
    w('2026-11-02', 'UTR', 'ADO', 2, 0),
    w('2026-11-09', 'ADO', 'AZ', 0, 1),    // vierde: valt buiten de drie
    w('2026-10-24', 'AJA', 'FEY', 1, 0),   // andere club: niet meetellen
  ]
  const erna = volgendeVan(lijst, 'ADO', '2026-10-17T18:45:00Z')
  assert.deepEqual(erna.map(m => m.datum), ['2026-10-21', '2026-10-26', '2026-11-02'])
})

test('volgendeVan: nog niet gespeelde wedstrijden tellen mee', () => {
  const lijst = [
    w('2026-10-17', 'ADO', 'PSV', 2, 1),
    w('2026-10-21', 'AJA', 'ADO', null, null, { gespeeld: false, winnaar: null }),
  ]
  assert.equal(volgendeVan(lijst, 'ADO', '2026-10-17T18:45:00Z').length, 1)
})

test('gemiddeldeVerlieskans: één verliezer per beslist duel, twee ploegen per wedstrijd', () => {
  // Vier wedstrijden, drie beslist -> 3 nederlagen op 8 ploegoptredens.
  const lijst = [
    w('2026-01-01', 'A', 'B', 1, 0),
    w('2026-01-02', 'C', 'D', 0, 2),
    w('2026-01-03', 'E', 'F', 1, 1),
    w('2026-01-04', 'G', 'H', 3, 1),
  ]
  assert.equal(gemiddeldeVerlieskans(lijst), 3 / 8)
  assert.equal(gemiddeldeVerlieskans([]), null)
})

test('maakVloek: koppelt elke nederlaag aan de drie wedstrijden erna', () => {
  const lijst = [
    w('2026-10-17', 'ADO', 'PSV', 2, 1),
    w('2026-10-21', 'AJA', 'ADO', 3, 0),
    w('2026-10-26', 'ADO', 'TWE', 1, 1),
    w('2026-11-02', 'UTR', 'ADO', 2, 0),
  ]
  const vloek = maakVloek(lijst)
  assert.equal(vloek.rijen.length, 1)

  const rij = vloek.rijen[0]
  assert.equal(rij.winnaar, 'ADO')
  assert.deepEqual(rij.erna.map(e => e.resultaat), ['V', 'G', 'V'])
  // De uitslag staat vanuit ADO zelf: uit bij Ajax verloren ze met 0-3.
  assert.deepEqual(rij.erna.map(e => e.score), ['0–3', '1–1', '0–2'])
  // Thuis of uit, gezien vanuit de winnaar.
  assert.deepEqual(rij.erna.map(e => e.thuis), [false, true, false])

  assert.deepEqual(vloek.samenvatting.per, [
    { nr: 1, verloren: 1, van: 1 },
    { nr: 2, verloren: 0, van: 1 },
    { nr: 3, verloren: 1, van: 1 },
  ])
  assert.equal(vloek.samenvatting.nederlagen, 1)
  assert.equal(vloek.samenvatting.treffers, 2)
  assert.equal(vloek.samenvatting.kansen, 3)
})

test('maakVloek: nieuwste nederlaag bovenaan', () => {
  const lijst = [
    w('2026-09-12', 'AZ', 'PSV', 3, 0),
    w('2026-10-17', 'ADO', 'PSV', 2, 1),
  ]
  assert.deepEqual(maakVloek(lijst).rijen.map(r => r.winnaar), ['ADO', 'AZ'])
})

test('maakVloek: een nog te spelen vervolgwedstrijd telt niet mee in de noemer', () => {
  const lijst = [
    w('2026-10-17', 'ADO', 'PSV', 2, 1),
    w('2026-10-21', 'AJA', 'ADO', 3, 0),
    w('2026-10-26', 'ADO', 'TWE', null, null, { gespeeld: false, winnaar: null }),
  ]
  const { samenvatting, rijen } = maakVloek(lijst)
  assert.equal(rijen[0].erna.length, 2)
  assert.deepEqual(samenvatting.per, [
    { nr: 1, verloren: 1, van: 1 },
    { nr: 2, verloren: 0, van: 0 },
    { nr: 3, verloren: 0, van: 0 },
  ])
})

test('maakVloek: zonder nederlagen een lege maar bruikbare uitkomst', () => {
  const { rijen, samenvatting } = maakVloek([w('2026-10-25', 'PSV', 'FEY', 3, 0)])
  assert.deepEqual(rijen, [])
  assert.equal(samenvatting.nederlagen, 0)
  assert.equal(samenvatting.vloekKans, null)
})
