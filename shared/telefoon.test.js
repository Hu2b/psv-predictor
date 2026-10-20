import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normaliseerTelefoon, toonTelefoon } from './telefoon.js'

test('normaliseerTelefoon: Nederlandse schrijfwijzen leveren allemaal hetzelfde op', () => {
  const verwacht = '31612345678'
  assert.equal(normaliseerTelefoon('0612345678'), verwacht)
  assert.equal(normaliseerTelefoon('06 12345678'), verwacht)
  assert.equal(normaliseerTelefoon('06-12345678'), verwacht)
  assert.equal(normaliseerTelefoon('+31612345678'), verwacht)
  assert.equal(normaliseerTelefoon('+31 6 12345678'), verwacht)
  assert.equal(normaliseerTelefoon('0031612345678'), verwacht)
})

test('normaliseerTelefoon: buitenlands nummer met landcode blijft intact', () => {
  assert.equal(normaliseerTelefoon('+49 171 1234567'), '491711234567')
})

test('normaliseerTelefoon: onbruikbare invoer levert null', () => {
  assert.equal(normaliseerTelefoon(''), null)
  assert.equal(normaliseerTelefoon(null), null)
  assert.equal(normaliseerTelefoon('06123'), null)       // te kort
  assert.equal(normaliseerTelefoon('geen nummer'), null)
})

test('toonTelefoon: zet het opgeslagen nummer terug naar +formaat', () => {
  assert.equal(toonTelefoon('31612345678'), '+31612345678')
  assert.equal(toonTelefoon(null), '')
})
