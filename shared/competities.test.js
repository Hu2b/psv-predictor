import { test } from 'node:test'
import assert from 'node:assert/strict'
import { competitieNaam } from './competities.js'

test('competitieNaam: vertaalt bekende codes naar volledige naam', () => {
  assert.equal(competitieNaam('ERE'), 'Eredivisie')
  assert.equal(competitieNaam('CL'), 'Champions League')
  assert.equal(competitieNaam('KNVB'), 'KNVB Beker')
})

test('competitieNaam: valt terug op de code zelf bij onbekend', () => {
  assert.equal(competitieNaam('XYZ'), 'XYZ')
})
