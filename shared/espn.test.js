import { test } from 'node:test'
import assert from 'node:assert/strict'
import { espnCompetitie, espnDatum, espnDatumVarianten, teamKomtOvereen, zoekEspnWedstrijd, maakOpstelling, opstellingIsDefinitief, espnStatus, wedstrijdStatus, minuutNummer, psvEerst } from './espn.js'

test('espnCompetitie: bekende competities krijgen een pad, onbekende niets', () => {
  assert.equal(espnCompetitie('ERE'), 'ned.1')
  assert.equal(espnCompetitie('CL'), 'uefa.champions')
  assert.equal(espnCompetitie('VRI'), null)
  assert.equal(espnCompetitie(undefined), null)
})

test('espnDatum: UTC-datum als JJJJMMDD', () => {
  assert.equal(espnDatum('2026-10-18T14:45Z'), '20261018')
  // Laat op de avond in Nederland is het bij ESPN nog dezelfde UTC-dag.
  assert.equal(espnDatum('2026-10-23T18:00Z'), '20261023')
  assert.equal(espnDatum(null), null)
  assert.equal(espnDatum('geen datum'), null)
})

test('espnDatumVarianten: eigen dag eerst, daarna de dag ervoor en erna', () => {
  assert.deepEqual(espnDatumVarianten('2026-10-18T14:45Z'), ['20261018', '20261017', '20261019'])
  // Over een maandgrens heen moet de kalender gewoon kloppen.
  assert.deepEqual(espnDatumVarianten('2026-11-01T19:00Z'), ['20261101', '20261031', '20261102'])
  assert.deepEqual(espnDatumVarianten('geen datum'), [])
})

test('teamKomtOvereen: verschillende schrijfwijzes van dezelfde club matchen', () => {
  assert.equal(teamKomtOvereen('PSV Eindhoven', 'PSV'), true)
  assert.equal(teamKomtOvereen('Ajax Amsterdam', 'AJA'), true)
  assert.equal(teamKomtOvereen('FC Groningen', 'GRO'), true)
  assert.equal(teamKomtOvereen('AZ Alkmaar', 'AZ'), true)
})

test('teamKomtOvereen: andere clubs matchen niet, ook niet als ze op elkaar lijken', () => {
  assert.equal(teamKomtOvereen('FC Utrecht', 'TWE'), false)
  assert.equal(teamKomtOvereen('Ajax Amsterdam', 'PSV'), false)
  assert.equal(teamKomtOvereen('', 'PSV'), false)
})

const EVENTS = [
  {
    id: '401875575',
    competitions: [{
      competitors: [
        { homeAway: 'home', team: { displayName: 'FC Groningen' } },
        { homeAway: 'away', team: { displayName: 'Ajax Amsterdam' } },
      ],
    }],
  },
  {
    id: '401875580',
    competitions: [{
      competitors: [
        { homeAway: 'home', team: { displayName: 'PSV Eindhoven' } },
        { homeAway: 'away', team: { displayName: 'Feyenoord Rotterdam' } },
      ],
    }],
  },
]

test('zoekEspnWedstrijd: vindt de juiste wedstrijd tussen meerdere van dezelfde dag', () => {
  assert.equal(zoekEspnWedstrijd(EVENTS, 'PSV', 'FEY'), '401875580')
  assert.equal(zoekEspnWedstrijd(EVENTS, 'GRO', 'AJA'), '401875575')
})

test('zoekEspnWedstrijd: thuis en uit omgedraaid telt ook als treffer', () => {
  assert.equal(zoekEspnWedstrijd(EVENTS, 'FEY', 'PSV'), '401875580')
})

test('zoekEspnWedstrijd: liever niets dan de verkeerde wedstrijd', () => {
  // Eén team klopt, het andere niet — dat mag geen treffer zijn.
  assert.equal(zoekEspnWedstrijd(EVENTS, 'PSV', 'AJA'), null)
  assert.equal(zoekEspnWedstrijd([], 'PSV', 'FEY'), null)
  assert.equal(zoekEspnWedstrijd(undefined, 'PSV', 'FEY'), null)
})

const ROSTERS = [{
  homeAway: 'home',
  team: { displayName: 'FC Groningen', logos: [{ href: 'logo.png' }] },
  formation: '4-2-3-1',
  roster: [
    { starter: true, jersey: '9', formationPlace: '9', athlete: { displayName: 'Spits' }, position: { abbreviation: 'F', displayName: 'Forward' }, subbedOut: true },
    { starter: true, jersey: '1', formationPlace: '1', athlete: { displayName: 'Keeper' }, position: { abbreviation: 'G', displayName: 'Goalkeeper' } },
    { starter: false, jersey: '20', athlete: { displayName: 'Invaller' }, position: { abbreviation: 'SUB' }, subbedIn: true },
  ],
}]

test('maakOpstelling: basis op veldvolgorde, bank apart', () => {
  const [ploeg] = maakOpstelling(ROSTERS)
  assert.equal(ploeg.team, 'FC Groningen')
  assert.equal(ploeg.formatie, '4-2-3-1')
  assert.equal(ploeg.thuisUit, 'thuis')
  assert.equal(ploeg.logo, 'logo.png')
  // Keeper (plek 1) hoort vóór de spits (plek 9) te staan.
  assert.deepEqual(ploeg.basis.map(s => s.naam), ['Keeper', 'Spits'])
  assert.deepEqual(ploeg.bank.map(s => s.naam), ['Invaller'])
  assert.equal(ploeg.basis[1].gewisseld, true)
})

test('maakOpstelling: zonder gegevens een lege lijst, geen fout', () => {
  assert.deepEqual(maakOpstelling(undefined), [])
  assert.deepEqual(maakOpstelling([]), [])
})

test('opstellingIsDefinitief: pas vanaf de aftrap definitief', () => {
  const met = staat => ({ header: { competitions: [{ status: { type: { state: staat } } }] } })
  assert.equal(opstellingIsDefinitief(met('pre')), false)
  assert.equal(opstellingIsDefinitief(met('in')), true)
  assert.equal(opstellingIsDefinitief(met('post')), true)
})

test('opstellingIsDefinitief: bij ontbrekende status liever voorlopig dan definitief', () => {
  assert.equal(opstellingIsDefinitief(undefined), false)
  assert.equal(opstellingIsDefinitief({}), false)
  assert.equal(opstellingIsDefinitief({ header: {} }), false)
})

test('espnStatus: ESPN-staat omgezet naar onze drie woorden', () => {
  const met = staat => ({ header: { competitions: [{ status: { type: { state: staat } } }] } })
  assert.equal(espnStatus(met('pre')), 'voor')
  assert.equal(espnStatus(met('in')), 'bezig')
  assert.equal(espnStatus(met('post')), 'afgelopen')
})

test('espnStatus: onbekend telt als "voor", zodat er blijft bijgewerkt', () => {
  assert.equal(espnStatus(undefined), 'voor')
  assert.equal(espnStatus({}), 'voor')
  assert.equal(espnStatus({ header: { competitions: [{}] } }), 'voor')
})

test('wedstrijdStatus: de statuscode van onze eigen agenda telt', () => {
  assert.equal(wedstrijdStatus({ status: 'FT' }), 'afgelopen')
  assert.equal(wedstrijdStatus({ status: 'PEN' }), 'afgelopen')
  assert.equal(wedstrijdStatus({ status: '2H' }), 'bezig')
  assert.equal(wedstrijdStatus({ status: 'TIMED', datumISO: '2026-10-25T18:45Z' }, Date.parse('2026-10-25T12:00Z')), 'voor')
})

test('wedstrijdStatus: zonder bruikbare status beslist de klok', () => {
  const aftrap = '2026-10-25T18:45Z'
  // Tijdens de wedstrijd nog niet afgelopen...
  assert.equal(wedstrijdStatus({ datumISO: aftrap }, Date.parse('2026-10-25T20:00Z')), 'voor')
  // ...maar drie uur na de aftrap zeker wel.
  assert.equal(wedstrijdStatus({ datumISO: aftrap }, Date.parse('2026-10-26T09:00Z')), 'afgelopen')
  assert.equal(wedstrijdStatus(undefined), 'voor')
  assert.equal(wedstrijdStatus({ datumISO: 'geen datum' }), 'voor')
})

test('minuutNummer: eerste getal uit de kloktekst', () => {
  assert.equal(minuutNummer("83'"), 83)
  assert.equal(minuutNummer("90'+3'"), 90)
  assert.equal(minuutNummer('45'), 45)
  assert.equal(minuutNummer(''), 0)
  assert.equal(minuutNummer(undefined), 0)
})

const ROSTERS_MET_WISSELS = [{
  homeAway: 'home',
  team: { displayName: 'PSV Eindhoven' },
  roster: [
    {
      starter: true, jersey: '9', formationPlace: '9',
      athlete: { displayName: 'Spits' },
      position: { abbreviation: 'F' },
      subbedOut: true,
      subbedOutFor: { athlete: { displayName: 'Invaller Laat' } },
      plays: [{ substitution: true, clock: { displayValue: "83'" } }],
    },
    {
      starter: true, jersey: '6', formationPlace: '6',
      athlete: { displayName: 'Middenvelder' },
      position: { abbreviation: 'M' },
      subbedOut: true,
      subbedOutFor: { athlete: { displayName: 'Invaller Vroeg' } },
      plays: [{ substitution: true, clock: { displayValue: "61'" } }],
    },
    {
      starter: false, jersey: '20',
      athlete: { displayName: 'Invaller Laat' },
      position: { abbreviation: 'SUB' },
      subbedIn: true,
      subbedInFor: { athlete: { displayName: 'Spits' } },
      plays: [{ substitution: true, clock: { displayValue: "83'" } }],
    },
    {
      starter: false, jersey: '21',
      athlete: { displayName: 'Invaller Vroeg' },
      position: { abbreviation: 'SUB' },
      subbedIn: true,
      subbedInFor: { athlete: { displayName: 'Middenvelder' } },
      plays: [{ substitution: true, clock: { displayValue: "61'" } }],
    },
    { starter: false, jersey: '22', athlete: { displayName: 'Blijft Zitten' }, position: { abbreviation: 'SUB' } },
  ],
}]

test('maakOpstelling: wissels op een rij, chronologisch en met de juiste namen', () => {
  const [ploeg] = maakOpstelling(ROSTERS_MET_WISSELS)
  assert.deepEqual(ploeg.wissels, [
    { minuut: "61'", erin: 'Invaller Vroeg', eruit: 'Middenvelder' },
    { minuut: "83'", erin: 'Invaller Laat', eruit: 'Spits' },
  ])
})

test('maakOpstelling: de minuut staat ook bij de gewisselde basisspeler', () => {
  const [ploeg] = maakOpstelling(ROSTERS_MET_WISSELS)
  const spits = ploeg.basis.find(s => s.naam === 'Spits')
  assert.equal(spits.gewisseld, true)
  assert.equal(spits.minuut, "83'")
  assert.equal(spits.vervangenDoor, 'Invaller Laat')
})

test('maakOpstelling: zonder wissels blijft de lijst leeg', () => {
  const [ploeg] = maakOpstelling(ROSTERS)
  // De spits staat wel als gewisseld, maar ESPN meldt (nog) niet wie erin kwam.
  assert.deepEqual(ploeg.wissels, [])
})

test('psvEerst: PSV bovenaan, thuis of uit maakt niet uit', () => {
  const uit = [{ team: 'FC Porto' }, { team: 'PSV Eindhoven' }]
  assert.deepEqual(psvEerst(uit).map(o => o.team), ['PSV Eindhoven', 'FC Porto'])

  const thuis = [{ team: 'PSV Eindhoven' }, { team: 'Ajax Amsterdam' }]
  assert.deepEqual(psvEerst(thuis).map(o => o.team), ['PSV Eindhoven', 'Ajax Amsterdam'])
})

test('psvEerst: laat de volgorde met rust als PSV er niet bij staat', () => {
  const zonder = [{ team: 'Feyenoord Rotterdam' }, { team: 'Ajax Amsterdam' }]
  assert.deepEqual(psvEerst(zonder).map(o => o.team), ['Feyenoord Rotterdam', 'Ajax Amsterdam'])
  assert.deepEqual(psvEerst(undefined), [])
})
