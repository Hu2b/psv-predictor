import { test } from 'node:test'
import assert from 'node:assert/strict'
import { zoekAfkorting, zoekNaam, zoekVerzorgdeNaam } from './teams.js'

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

test('zoekAfkorting: football-data.org-namen met achtervoegsel mappen correct', () => {
  // football-data.org gebruikt langere officiële namen; zonder deze aliassen
  // viel de app terug op de eerste 3 letters (bijv. "Club Atlético de Madrid"
  // -> "CLU" i.p.v. ATM).
  assert.equal(zoekAfkorting('Club Atlético de Madrid'), 'ATM')
  assert.equal(zoekAfkorting('Club Atletico de Madrid'), 'ATM')
  assert.equal(zoekAfkorting('Real Madrid CF'), 'RMA')
  assert.equal(zoekAfkorting('Club Brugge KV'), 'CLU')
})

test('zoekVerzorgdeNaam: maakt van API-namen en bijnamen één vaste clubnaam', () => {
  assert.equal(zoekVerzorgdeNaam('PSV'), 'PSV Eindhoven')
  assert.equal(zoekVerzorgdeNaam('Club Atlético de Madrid'), 'Atlético Madrid')
  assert.equal(zoekVerzorgdeNaam('Atleti'), 'Atlético Madrid')
  assert.equal(zoekVerzorgdeNaam('Real Madrid CF'), 'Real Madrid')
  assert.equal(zoekVerzorgdeNaam('Club Brugge KV'), 'Club Brugge')
})

test('zoekVerzorgdeNaam: houdt de API-naam aan bij een onbekend team', () => {
  // Mag NIET via de 3-letter-noodgreep bij een bestaande club uitkomen
  // (Portsmouth -> POR -> FC Porto zou fout zijn).
  assert.equal(zoekVerzorgdeNaam('Portsmouth FC'), 'Portsmouth FC')
  assert.equal(zoekVerzorgdeNaam(''), '')
})
