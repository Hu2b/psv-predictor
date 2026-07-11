import { kvGet, kvSet } from './_kv.js'
import { berekenPunten, totoLabel } from './_scoring.js'
import { zoekAfkorting } from '../shared/teams.js'
import { bewaarLogoAlsNieuw, zoekLogo } from './_logo-lookup.js'
import { alleGeverifieerdeSpelers } from './_players.js'

const API_KEY = process.env.FOOTBALL_DATA_KEY
const API_BASE = 'https://api.football-data.org/v4'

function bepaalSeizoen() {
  const nu = new Date()
  const jaar = nu.getFullYear()
  const maand = nu.getMonth() + 1
  const dag = nu.getDate()
  if (maand > 6 || (maand === 6 && dag >= 15)) return jaar
  return jaar - 1
}

export const SEASON = parseInt(process.env.PSV_SEASON || String(bepaalSeizoen()))
const COMPETITIONS = { DED: 'ERE', CL: 'CL' }

// Elke 5 minuten verversen: 2 aanroepen naar football-data.org per ververs-
// beurt, ruim binnen hun limiet van 10 aanroepen per minuut (gratis laag).
const CACHE_TTL_MS = 5 * 60 * 1000

function dagAfkorting(dateStr) {
  const d = new Date(dateStr)
  const dagen = ['zo','ma','di','wo','do','vr','za']
  return dagen[d.getDay()]
}

function formatDatum(dateStr) {
  const d = new Date(dateStr)
  const maanden = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']
  return `${dagAfkorting(dateStr)} ${d.getDate()} ${maanden[d.getMonth()]} ${d.getFullYear()}`
}

function mapStatus(s) {
  if (s === 'FINISHED') return 'FT'
  if (s === 'IN_PLAY' || s === 'PAUSED') return 'LIVE'
  return 'NS'
}

async function fetchCompetitionMatches(code) {
  const url = `${API_BASE}/competitions/${code}/matches?season=${SEASON}`
  const res = await fetch(url, { headers: { 'X-Auth-Token': API_KEY } })
  const data = await res.json()
  if (data.error || data.errorCode) return []
  return data.matches || []
}

function mapMatch(m, comp) {
  const status = mapStatus(m.status)
  let uitslag = null
  if (status === 'FT') {
    uitslag = { home: m.score.fullTime.home, away: m.score.fullTime.away, status: 'FT' }
  } else if (status === 'LIVE') {
    uitslag = { home: m.score.fullTime.home ?? 0, away: m.score.fullTime.away ?? 0, status: 'LIVE' }
  }
  return {
    matchId: m.id, competitie: comp,
    thuis: zoekAfkorting(m.homeTeam.name), thuisNaam: m.homeTeam.name,
    thuisLogo: m.homeTeam.crest, thuisId: m.homeTeam.id,
    uit: zoekAfkorting(m.awayTeam.name), uitNaam: m.awayTeam.name,
    uitLogo: m.awayTeam.crest, uitId: m.awayTeam.id,
    dag: dagAfkorting(m.utcDate), datum: formatDatum(m.utcDate),
    datumISO: m.utcDate, status, uitslag,
  }
}

// Haalt alleen de automatische (football-data.org) wedstrijden op, met cache
async function haalAutomatischeWedstrijden() {
  const cacheKey = `psv:fixtures:fd:${SEASON}`
  const cached = await kvGet(cacheKey)
  const nu = Date.now()

  if (cached?.fixtures && cached?.cached_at) {
    const leeftijdMs = nu - new Date(cached.cached_at).getTime()
    if (leeftijdMs < CACHE_TTL_MS) return cached.fixtures
  }

  if (!API_KEY) {
    return cached?.fixtures || []
  }

  try {
    const PSV_NAMES = ['PSV', 'PSV Eindhoven']
    let fixtures = []
    for (const [code, comp] of Object.entries(COMPETITIONS)) {
      const matches = await fetchCompetitionMatches(code)
      const psvMatches = matches.filter(m =>
        PSV_NAMES.includes(m.homeTeam.name) || PSV_NAMES.includes(m.awayTeam.name)
      )
      fixtures = fixtures.concat(psvMatches.map(m => mapMatch(m, comp)))
    }
    const payload = { fixtures, cached_at: new Date().toISOString() }
    await kvSet(cacheKey, payload)
    return fixtures
  } catch (err) {
    console.error('Automatische wedstrijden ophalen mislukt:', err)
    // Bij een fout: liever verouderde data tonen dan niets, ook als de cache
    // al ouder is dan de TTL.
    return cached?.fixtures || []
  }
}

export async function haalAlleWedstrijden() {
  const [automatisch, handmatig] = await Promise.all([
    haalAutomatischeWedstrijden(),
    kvGet('admin:wedstrijden'),
  ])

  await Promise.all(
    automatisch.flatMap(f => [
      bewaarLogoAlsNieuw(f.thuis, f.thuisLogo),
      bewaarLogoAlsNieuw(f.uit, f.uitLogo),
    ])
  )

  const handmatigMetLogos = await Promise.all(
    (handmatig || []).map(async f => ({
      ...f,
      thuisLogo: f.thuisLogo || await zoekLogo(f.thuis),
      uitLogo: f.uitLogo || await zoekLogo(f.uit),
    }))
  )

  const seen = new Set()
  let alle = [...automatisch, ...handmatigMetLogos].filter(f => {
    const id = String(f.matchId)
    if (seen.has(id)) return false
    seen.add(id); return true
  })

  alle.sort((a, b) => new Date(a.datumISO) - new Date(b.datumISO))
  alle = alle.map((f, i) => ({ ...f, volgnummer: i + 1 }))

  return alle
}

export async function zoekVolgnummer(matchId) {
  const alle = await haalAlleWedstrijden()
  const f = alle.find(w => String(w.matchId) === String(matchId))
  return f ? f.volgnummer : null
}

// Enige, centrale plek waar een uitslag wordt verwerkt tot punten en totalen.
// ALLE geverifieerde spelers krijgen een entry: wie niet op tijd heeft
// voorspeld (of helemaal niet), krijgt hier expliciet 0 punten.
// Wordt herbruikt door zowel de automatische verwerking als Admin (handmatige
// invoer), zodat de puntenlogica nooit op twee plekken kan gaan afwijken.
export async function berekenEnSlaResultaatOp(fixtureInfo, uitslag) {
  const { matchId, volgnummer, datumISO, datum, competitie, thuis, uit } = fixtureInfo

  const spelers = await alleGeverifieerdeSpelers()
  const predicties = {}
  const toto = {}
  const punten = {}

  for (const speler of spelers) {
    const pred = await kvGet(`prediction:${matchId}:${speler.id}`)
    if (pred) {
      predicties[speler.id] = { home: pred.home, away: pred.away }
      toto[speler.id] = totoLabel(pred)
      punten[speler.id] = berekenPunten(pred, uitslag)
    } else {
      predicties[speler.id] = null
      toto[speler.id] = null
      punten[speler.id] = 0
    }
  }

  const vorigeResult = await kvGet(`result:${matchId}`)
  const totals = await kvGet('totals') || {}
  const nieuweTotals = { ...totals }

  if (vorigeResult) {
    for (const [playerId, oud] of Object.entries(vorigeResult.punten || {})) {
      nieuweTotals[playerId] = (nieuweTotals[playerId] || 0) - oud
    }
  }
  for (const [playerId, p] of Object.entries(punten)) {
    nieuweTotals[playerId] = (nieuweTotals[playerId] || 0) + p
  }

  const totalen = {}
  for (const playerId of Object.keys(punten)) {
    totalen[playerId] = nieuweTotals[playerId]
  }

  const result = {
    matchId, uitslag, volgnummer,
    predicties, toto, punten, totalen,
    datumISO, datum, competitie, thuis, uit,
    verwerktOp: new Date().toISOString(),
  }

  await kvSet(`result:${matchId}`, result)
  await kvSet('totals', nieuweTotals)

  const index = await kvGet('results:index') || []
  if (!index.includes(String(matchId))) {
    index.push(String(matchId))
    await kvSet('results:index', index)
  }

  return result
}

export async function checkEnSlaUitslagenOp(fixtures) {
  const nu = Date.now()
  const MIN_135 = 135 * 60 * 1000

  for (const f of fixtures) {
    if (f.status === 'NS') continue
    if (!f.uitslag || f.uitslag.status !== 'FT') continue

    const wedstrijdTijd = new Date(f.datumISO).getTime()
    if (nu - wedstrijdTijd < MIN_135) continue

    const bestaand = await kvGet(`result:${f.matchId}`)
    if (bestaand) continue

    await berekenEnSlaResultaatOp(f, f.uitslag)
  }
}
