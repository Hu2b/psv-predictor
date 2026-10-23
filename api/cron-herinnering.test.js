import { test } from 'node:test'
import assert from 'node:assert/strict'
import { valtInVenster, wachtendeWedstrijden } from './cron-herinnering.js'

const AFTRAP = '2026-10-17T14:30:00Z' // 16:30 Nederlandse tijd
const minutenVoor = m => Date.parse(AFTRAP) - m * 60000

test('valtInVenster: rond een half uur voor de aftrap', () => {
  assert.equal(valtInVenster(AFTRAP, minutenVoor(30)), true)
  assert.equal(valtInVenster(AFTRAP, minutenVoor(40)), true)
  assert.equal(valtInVenster(AFTRAP, minutenVoor(20)), true)
})

test('valtInVenster: te vroeg en te laat tellen niet', () => {
  assert.equal(valtInVenster(AFTRAP, minutenVoor(41)), false)
  assert.equal(valtInVenster(AFTRAP, minutenVoor(19)), false)
  // Na de aftrap heeft een herinnering geen zin meer.
  assert.equal(valtInVenster(AFTRAP, minutenVoor(-5)), false)
  assert.equal(valtInVenster('geen datum', Date.now()), false)
})

test('wachtendeWedstrijden: alleen wat nog gespeeld moet worden en nu aan de beurt is', () => {
  const fixtures = [
    { matchId: 1, datumISO: AFTRAP, status: 'TIMED' },
    { matchId: 2, datumISO: AFTRAP, status: 'FT' },       // al gespeeld
    { matchId: 3, datumISO: AFTRAP, status: '1H' },        // al begonnen
    { matchId: 4, datumISO: '2026-11-01T19:00:00Z', status: 'TIMED' }, // veel later
  ]
  const gevonden = wachtendeWedstrijden(fixtures, minutenVoor(30))
  assert.deepEqual(gevonden.map(f => f.matchId), [1])
})

test('wachtendeWedstrijden: zonder wedstrijden geen fout', () => {
  assert.deepEqual(wachtendeWedstrijden(undefined, Date.now()), [])
  assert.deepEqual(wachtendeWedstrijden([], Date.now()), [])
})
