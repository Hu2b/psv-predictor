import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normaliseerFootballData, normaliseerEspn, clubSleutel, seizoenMaanden, formatDatum } from './_vloekdata.js'

test('clubSleutel: beide bronnen komen op dezelfde sleutel uit', () => {
  // football-data schrijft "AFC Ajax", ESPN "Ajax" — zonder dit zouden het
  // twee verschillende clubs lijken en klopt "de volgende wedstrijd" niet.
  assert.equal(clubSleutel('AFC Ajax'), clubSleutel('Ajax'))
  assert.equal(clubSleutel('PSV'), 'PSV')
  // Een amateurclub uit de beker kennen we niet; die krijgt zijn eigen
  // sleutel en mag nooit op een bestaande code lijken.
  assert.equal(clubSleutel('Staphorst'), '~staphorst')
  assert.equal(clubSleutel(''), '???')
})

test('clubSleutel: twee onbekende clubs met dezelfde beginletters blijven apart', () => {
  // Precies de valkuil van zoekAfkorting(): beide zouden "SPA" worden, en dan
  // zou Spakenburg de wedstrijden van Sparta erbij krijgen.
  assert.notEqual(clubSleutel('Spakenburg'), clubSleutel('Spartaan 20'))
  // En een onbekende club mag nooit samenvallen met een club die we wél kennen.
  assert.notEqual(clubSleutel('Portsmouth'), clubSleutel('FC Porto'))
})

test('normaliseerFootballData: afgelopen wedstrijd met winnaar', () => {
  const w = normaliseerFootballData({
    utcDate: '2026-10-17T18:45:00Z',
    status: 'FINISHED',
    homeTeam: { name: 'ADO Den Haag' },
    awayTeam: { name: 'PSV' },
    score: { winner: 'HOME_TEAM', fullTime: { home: 2, away: 1 } },
  })
  assert.equal(w.competitie, 'ERE')
  assert.equal(w.thuis, 'ADO')
  assert.equal(w.uit, 'PSV')
  assert.equal(w.home, 2)
  assert.equal(w.away, 1)
  assert.equal(w.winnaar, 'HOME')
  assert.equal(w.gespeeld, true)
})

test('normaliseerFootballData: nog te spelen wedstrijd heeft geen winnaar', () => {
  const w = normaliseerFootballData({
    utcDate: '2026-11-08T18:45:00Z',
    status: 'TIMED',
    homeTeam: { name: 'PSV' }, awayTeam: { name: 'Feyenoord' },
    score: { winner: null, fullTime: { home: null, away: null } },
  })
  assert.equal(w.gespeeld, false)
  assert.equal(w.winnaar, null)
  assert.equal(w.home, null)
})

test('normaliseerFootballData: een toegekende uitslag telt als gespeeld', () => {
  const w = normaliseerFootballData({
    utcDate: '2026-02-01T14:30:00Z', status: 'AWARDED',
    homeTeam: { name: 'PSV' }, awayTeam: { name: 'Ajax' },
    score: { winner: 'AWAY_TEAM', fullTime: { home: 0, away: 3 } },
  })
  assert.equal(w.gespeeld, true)
  assert.equal(w.winnaar, 'AWAY')
})

const espnDuel = (thuisScore, uitScore, extra = {}) => ({
  date: '2026-12-16T19:00:00Z',
  competitions: [{
    status: { type: { state: 'post', completed: true } },
    competitors: [
      { homeAway: 'home', score: String(thuisScore), team: { displayName: 'FC Groningen' }, ...(extra.thuis || {}) },
      { homeAway: 'away', score: String(uitScore), team: { displayName: 'PSV Eindhoven' }, ...(extra.uit || {}) },
    ],
  }],
})

test('normaliseerEspn: bekerwedstrijd met een gewone uitslag', () => {
  const w = normaliseerEspn(espnDuel(2, 1))
  assert.equal(w.competitie, 'KNVB')
  assert.equal(w.thuis, 'GRO')
  assert.equal(w.uit, 'PSV')
  assert.equal(w.winnaar, 'HOME')
  assert.equal(w.naStrafschoppen, false)
  assert.equal(w.gespeeld, true)
})

test('normaliseerEspn: gelijk, maar iemand ging door — dat is de winnaar', () => {
  const w = normaliseerEspn(espnDuel(1, 1, { thuis: { winner: true } }))
  assert.equal(w.winnaar, 'HOME')
  assert.equal(w.naStrafschoppen, true)
  // De uitslag blijft 1-1; alleen de winnaar is anders bepaald.
  assert.equal(w.home, 1)
  assert.equal(w.away, 1)
})

test('normaliseerEspn: gelijkspel zonder doorgaande ploeg blijft gelijkspel', () => {
  const w = normaliseerEspn(espnDuel(1, 1))
  assert.equal(w.winnaar, 'DRAW')
  assert.equal(w.naStrafschoppen, false)
})

test('normaliseerEspn: een wedstrijd die nog moet beginnen', () => {
  const duel = espnDuel(0, 0)
  duel.competitions[0].status = { type: { state: 'pre', completed: false } }
  const w = normaliseerEspn(duel)
  assert.equal(w.gespeeld, false)
  assert.equal(w.winnaar, null)
})

test('normaliseerEspn: onbruikbare invoer levert niets op, geen fout', () => {
  assert.equal(normaliseerEspn(undefined), null)
  assert.equal(normaliseerEspn({ competitions: [{ competitors: [] }] }), null)
})

test('seizoenMaanden: augustus tot en met juni, over de jaarwisseling heen', () => {
  const maanden = seizoenMaanden(2026)
  assert.equal(maanden.length, 11)
  assert.equal(maanden[0], '202608')
  assert.equal(maanden[4], '202612')
  assert.equal(maanden[5], '202701')
  assert.equal(maanden[10], '202706')
})

test('formatDatum: Nederlandse korte notatie', () => {
  assert.equal(formatDatum('2026-10-17T18:45:00Z'), '17 okt 2026')
  assert.equal(formatDatum('geen datum'), '')
})
