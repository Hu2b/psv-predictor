import { test } from 'node:test'
import assert from 'node:assert/strict'
import { seizoenVan, uitslagVoor, nederlagen, volgendeVan, gemiddeldeVerlieskans, puntenVoor, gemiddeldePunten, maakVloek } from './vloek.js'

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
    w('2026-11-09', 'ADO', 'AZ', 0, 1),
    w('2026-10-24', 'AJA', 'FEY', 1, 0),   // andere club: niet meetellen
  ]
  // Standaard twee; de rest valt er bewust buiten.
  const erna = volgendeVan(lijst, 'ADO', '2026-10-17T18:45:00Z')
  assert.deepEqual(erna.map(m => m.datum), ['2026-10-21', '2026-10-26'])
  // En met een eigen aantal werkt hij ook.
  assert.equal(volgendeVan(lijst, 'ADO', '2026-10-17T18:45:00Z', 4).length, 4)
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

test('maakVloek: koppelt elke nederlaag aan de twee wedstrijden erna', () => {
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
  // De derde wedstrijd erna valt er bewust buiten: daar vlakt het effect af.
  assert.deepEqual(rij.erna.map(e => e.resultaat), ['V', 'G'])
  // De uitslag staat vanuit ADO zelf: uit bij Ajax verloren ze met 0-3.
  assert.deepEqual(rij.erna.map(e => e.score), ['0–3', '1–1'])
  // Thuis of uit, gezien vanuit de winnaar.
  assert.deepEqual(rij.erna.map(e => e.thuis), [false, true])

  assert.deepEqual(vloek.samenvatting.per.map(p => [p.nr, p.verloren, p.van]), [
    [1, 1, 1], [2, 0, 1],
  ])
  assert.equal(vloek.samenvatting.nederlagen, 1)
  assert.equal(vloek.samenvatting.treffers, 1)
  assert.equal(vloek.samenvatting.kansen, 2)
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
  assert.deepEqual(samenvatting.per.map(p => [p.nr, p.verloren, p.van]), [
    [1, 1, 1], [2, 0, 0],
  ])
})

test('maakVloek: zonder nederlagen een lege maar bruikbare uitkomst', () => {
  const { rijen, samenvatting } = maakVloek([w('2026-10-25', 'PSV', 'FEY', 3, 0)])
  assert.deepEqual(rijen, [])
  assert.equal(samenvatting.nederlagen, 0)
  assert.equal(samenvatting.vloekKans, null)
})

test('puntenVoor: drie voor winst, een voor gelijk, nul voor verlies', () => {
  const m = w('2026-10-17', 'ADO', 'PSV', 2, 1)
  assert.equal(puntenVoor(m, 'ADO'), 3)
  assert.equal(puntenVoor(m, 'PSV'), 0)
  assert.equal(puntenVoor(w('2026-10-25', 'PSV', 'FEY', 1, 1), 'PSV'), 1)
  // Nog niet gespeeld levert geen punten op, ook geen nul.
  assert.equal(puntenVoor(w('2026-11-01', 'PSV', 'AJA', null, null, { gespeeld: false, winnaar: null }), 'PSV'), null)
})

test('gemiddeldePunten: het eigen gemiddelde van een club', () => {
  const lijst = [
    w('2026-08-01', 'ADO', 'NEC', 2, 0),   // 3
    w('2026-08-08', 'AJA', 'ADO', 1, 1),   // 1
    w('2026-08-15', 'ADO', 'AZ', 0, 2),    // 0
    w('2026-08-22', 'UTR', 'TWE', 1, 0),   // zonder ADO
  ]
  assert.equal(gemiddeldePunten(lijst, 'ADO'), 4 / 3)
  assert.equal(gemiddeldePunten(lijst, 'PSV'), null)
})

test('maakVloek: punten per vervolgwedstrijd en wat er is blijven liggen', () => {
  const lijst = [
    w('2026-10-17', 'ADO', 'PSV', 2, 1),
    w('2026-10-21', 'AJA', 'ADO', 3, 0),   // V -> 0
    w('2026-10-26', 'ADO', 'TWE', 1, 1),   // G -> 1
    w('2026-11-02', 'UTR', 'ADO', 2, 0),   // V -> 0
  ]
  const { rijen, samenvatting } = maakVloek(lijst)
  assert.deepEqual(rijen[0].erna.map(e => e.punten), [0, 1])
  assert.equal(rijen[0].gepakt, 1)
  assert.equal(rijen[0].mogelijk, 6)

  assert.equal(samenvatting.gepakt, 1)
  assert.equal(samenvatting.mogelijk, 6)
  assert.equal(samenvatting.gelaten, 5)
  assert.deepEqual(samenvatting.per.map(p => p.gepakt), [0, 1])
  assert.deepEqual(samenvatting.per.map(p => p.gelaten), [3, 2])
})

test('maakVloek: het eigen gemiddelde van de club is de maatstaf', () => {
  const lijst = [
    // ADO pakt in deze vier eigen wedstrijden 3+0+1+0 = 4 uit 4 -> 1,0 per duel
    w('2026-09-01', 'ADO', 'NEC', 2, 0),
    w('2026-10-17', 'ADO', 'PSV', 2, 1),
    w('2026-10-21', 'AJA', 'ADO', 3, 0),
    w('2026-10-26', 'ADO', 'TWE', 1, 1),
  ]
  const { samenvatting, rijen } = maakVloek(lijst)
  // Drie punten uit vier wedstrijden na aftrek van de PSV-zege zit erin; het
  // gaat erom dat er een eigen gemiddelde berekend is en een verwachting.
  assert.ok(rijen[0].normaal > 0)
  assert.equal(rijen[0].verwacht, rijen[0].normaal * 2)
  assert.ok(samenvatting.normaalPerWedstrijd > 0)
  assert.equal(samenvatting.perWedstrijd, 1 / 2)
})

test('maakVloek: bij een onbekende club komt de naam mee voor het scherm', () => {
  const beker = {
    datumISO: '2026-11-01T19:00:00Z', datum: '1 nov 2026', competitie: 'KNVB',
    thuis: "~excelsior '31", uit: 'ADO',
    thuisNaam: "Excelsior '31", uitNaam: 'ADO Den Haag',
    home: 1, away: 1, winnaar: 'HOME', naStrafschoppen: true, gespeeld: true,
  }
  const lijst = [w('2026-10-17', 'ADO', 'PSV', 2, 1), beker]
  const [rij] = maakVloek(lijst).rijen
  // De sleutel blijft wat hij is, maar er hoort een leesbare naam bij.
  assert.equal(rij.erna[0].tegenstander, "~excelsior '31")
  assert.equal(rij.erna[0].tegenstanderNaam, "Excelsior '31")
})

test('seizoenVan: een seizoen loopt van juli tot juni', () => {
  assert.equal(seizoenVan('2025-08-30T18:45:00Z'), 2025)
  assert.equal(seizoenVan('2026-03-22T14:30:00Z'), 2025)
  assert.equal(seizoenVan('2026-07-01T14:30:00Z'), 2026)
  assert.equal(seizoenVan('2026-06-30T14:30:00Z'), 2025)
  assert.equal(seizoenVan('geen datum'), null)
})
