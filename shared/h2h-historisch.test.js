import { test } from 'node:test'
import assert from 'node:assert/strict'
import { zoekHistorischeOntmoetingen } from './h2h-historisch.js'

test('zoekHistorischeOntmoetingen: vindt PSV-Real Madrid ongeacht de volgorde van de codes', () => {
  const a = zoekHistorischeOntmoetingen('PSV', 'RMA')
  const b = zoekHistorischeOntmoetingen('RMA', 'PSV')
  assert.deepEqual(a, b)
  assert.ok(a.length >= 2)
  assert.equal(a[0].competitie, 'EC1')
})

test('zoekHistorischeOntmoetingen: lege lijst voor onbekende combinatie of ontbrekende code', () => {
  assert.deepEqual(zoekHistorischeOntmoetingen('PSV', 'AJA'), [])
  assert.deepEqual(zoekHistorischeOntmoetingen('PSV', null), [])
  assert.deepEqual(zoekHistorischeOntmoetingen(null, 'RMA'), [])
})
