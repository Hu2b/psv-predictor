import { test } from 'node:test'
import assert from 'node:assert/strict'
import { zoekAfkorting, zoekNaam } from './teams.js'

test('zoekAfkorting: herkent de officiële naam en de code zelf', () => {
  assert.equal(zoekAfkorting('PSV Eindhoven'), 'PSV')
  assert.equal(zoekAfkorting('PSV'), 'PSV')
})

test('zoekAfkorting: herkent een alias', () => {
  assert.equal(zoekAfkorting('AFC Ajax'), 'AJA')
})

test('zoekAfkorting: valt terug op een 3-letterige code bij een onbekend team', () => {
  assert.equal(zoekAfkorting('Onbekende Club'), 'ONB')
})

test('zoekNaam: geeft de volledige naam bij een code', () => {
  assert.equal(zoekNaam('PSV'), 'PSV Eindhoven')
})

test('zoekAfkorting: herkent de handmatig toegevoegde CL-tegenstanders', () => {
  assert.equal(zoekAfkorting('Shakhtar Donetsk'), 'SHA')
  assert.equal(zoekAfkorting('RB Leipzig'), 'RBL')
  assert.equal(zoekAfkorting('FC Porto'), 'POR')
  assert.equal(zoekAfkorting('Viking FK'), 'VIK')
  assert.equal(zoekAfkorting('VfB Stuttgart'), 'VFB')
  assert.equal(zoekAfkorting('Club Brugge'), 'CLU')
})
