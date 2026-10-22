import { test } from 'node:test'
import assert from 'node:assert/strict'
import { espnCompetitie, espnDatum, teamKomtOvereen, zoekEspnWedstrijd, maakOpstelling } from './espn.js'

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
