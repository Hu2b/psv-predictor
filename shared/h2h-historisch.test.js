import { test } from 'node:test'
import assert from 'node:assert/strict'
import { zoekHistorischeOntmoetingen } from './h2h-historisch.js'

test('zoekHistorischeOntmoetingen: vindt PSV-Real Madrid ongeacht de volgorde van de codes', () => {
  const a = zoekHistorischeOntmoetingen('PSV', 'RMA')
  const b = zoekHistorischeOntmoetingen('RMA', 'PSV')
  assert.deepEqual(a, b)
  assert.ok(a.length >= 3)
  // De EC1-halvefinales uit 1988 horen erin te zitten
  assert.ok(a.some(m => m.competitie === 'EC1' && m.datum === '20 apr 1988'))
})

test('zoekHistorischeOntmoetingen: kent Porto en Club Brugge', () => {
  const porto = zoekHistorischeOntmoetingen('PSV', 'POR')
  assert.ok(porto.length >= 3)
  assert.ok(porto.some(m => m.uitslag === '5-0' && m.competitie === 'EC1'))

  const brugge = zoekHistorischeOntmoetingen('CLU', 'PSV')
  assert.ok(brugge.length >= 3)
  assert.equal(brugge[0].datum, '13 jul 2024')
})

test('zoekHistorischeOntmoetingen: lege lijst voor onbekende combinatie of ontbrekende code', () => {
  assert.deepEqual(zoekHistorischeOntmoetingen('PSV', 'AJA'), [])
  assert.deepEqual(zoekHistorischeOntmoetingen('PSV', null), [])
  assert.deepEqual(zoekHistorischeOntmoetingen(null, 'RMA'), [])
})
