import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mapStatus, mapMatch } from './_wedstrijden.js'

test('mapStatus: afgelopen wedstrijden, inclusief een toegekende uitslag', () => {
  assert.equal(mapStatus('FINISHED'), 'FT')
  // AWARDED = door de bond toegekend (bijv. na staking); telt als afgelopen.
  assert.equal(mapStatus('AWARDED'), 'FT')
})

test('mapStatus: lopende wedstrijden, inclusief verlenging en strafschoppen', () => {
  assert.equal(mapStatus('IN_PLAY'), 'LIVE')
  assert.equal(mapStatus('PAUSED'), 'LIVE')
  assert.equal(mapStatus('EXTRA_TIME'), 'LIVE')
  assert.equal(mapStatus('PENALTY_SHOOTOUT'), 'LIVE')
})

test('mapStatus: alles wat nog niet begonnen of niet doorgegaan is', () => {
  assert.equal(mapStatus('SCHEDULED'), 'NS')
  assert.equal(mapStatus('TIMED'), 'NS')
  assert.equal(mapStatus('POSTPONED'), 'NS')
  assert.equal(mapStatus('CANCELLED'), 'NS')
  assert.equal(mapStatus(undefined), 'NS')
})

function wedstrijd(status, fullTime) {
  return {
    id: 1, status,
    score: { fullTime },
    homeTeam: { name: 'PSV', crest: null, id: 1 },
    awayTeam: { name: 'FC Porto', crest: null, id: 2 },
    utcDate: '2026-10-20T19:00:00Z',
  }
}

test('mapMatch: afgelopen wedstrijd met ingevulde eindstand levert een uitslag', () => {
  const m = mapMatch(wedstrijd('FINISHED', { home: 0, away: 1 }), 'CL')
  assert.equal(m.status, 'FT')
  assert.deepEqual(m.uitslag, { home: 0, away: 1, status: 'FT' })
})

test('mapMatch: 0-0 telt als een geldige eindstand', () => {
  const m = mapMatch(wedstrijd('FINISHED', { home: 0, away: 0 }), 'CL')
  assert.deepEqual(m.uitslag, { home: 0, away: 0, status: 'FT' })
})

test('mapMatch: afgelopen zonder eindstand levert GEEN uitslag', () => {
  // Zou er wel een uitslag uitkomen, dan werd null-null vastgelegd: iedereen
  // 0 punten en een wedstrijd die zichzelf nooit meer herstelt.
  for (const score of [{ home: null, away: null }, { home: 2, away: null }, {}, undefined]) {
    const m = mapMatch(wedstrijd('FINISHED', score), 'CL')
    assert.equal(m.status, 'FT')
    assert.equal(m.uitslag, null)
  }
})

test('mapMatch: toegekende uitslag (AWARDED) wordt wel verwerkt', () => {
  const m = mapMatch(wedstrijd('AWARDED', { home: 3, away: 0 }), 'ERE')
  assert.equal(m.status, 'FT')
  assert.deepEqual(m.uitslag, { home: 3, away: 0, status: 'FT' })
})

test('mapMatch: lopende wedstrijd zonder score telt als 0-0', () => {
  const m = mapMatch(wedstrijd('IN_PLAY', { home: null, away: null }), 'ERE')
  assert.equal(m.status, 'LIVE')
  assert.deepEqual(m.uitslag, { home: 0, away: 0, status: 'LIVE' })
})

test('mapMatch: nog te spelen wedstrijd heeft geen uitslag', () => {
  const m = mapMatch(wedstrijd('SCHEDULED', {}), 'ERE')
  assert.equal(m.status, 'NS')
  assert.equal(m.uitslag, null)
})
