import { kvGet, kvSet } from './_kv.js'
import { berekenPunten, totoLabel } from './_scoring.js'
import { zoekAfkorting } from '../shared/teams.js'
import { bewaarLogoAlsNieuw, zoekLogo } from './_logo-lookup.js'

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

function getNLHour() {
  const nu = new Date()
  const nlStr = nu.toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam', hour: '2-digit', hour12: false })
  return parseInt(nlStr)
}

function getNLDatumKey() {
  const nu = new Date()
  return nu.toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit' })
}

function getTijdvenster() {
  const uur = getNLHour()
  if (uur >= 10 && uur < 14) return 1
  if (uur >= 14 && uur < 19) return 2
  if (uur >= 19 && uur < 22) return 3
  return 0
}

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

async function haalAutomatischeWedstrijden() {
  const datumKey = getNLDatumKey()
  const venster = getTijdvenster()
  const cacheKey = `psv:fixtures:fd:${SEASON}:${datumKey}:v${venster}`
  const fallbackKey = `psv:fixtures:fd:${SEASON}:latest`

  if (venster === 0) {
    const cached = await kvGet(fallbackKey)
    if (cached?.fixtures) return cached.fixtures
  }

  const vensterCache = await kvGet(cacheKey)
  if (vensterCache?.fixtures) return vensterCache.fixtures

  if (!API_KEY) {
    const fallback = await kvGet(fallbackKey)
    return fallback?.fixtures || []
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
    await kvSet(fallbackKey, payload)
    return fixtures
  } catch (err) {
    console.error('Automatische wedstrijden ophalen mislukt:', err)
    const fallback = await kvGet(fallbackKey)
    return fallback?.fixtures || []
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

async function verwerkUitslag(fixture, uitslag) {
  const matchId = fixture.matchId
  const bestaand = await kvGet(`result:${matchId}`)
  if (bestaand) return

  const predictionIndex = await kvGet(`predictionIndex:${matchId}`) || []
  const predicties = {}
  const punten = {}
  const toto = {}

  for (const playerId of predictionIndex) {
    const pred = await kvGet(`prediction:${matchId}:${playerId}`)
    if (!pred) continue
    predicties[playerId] = { home: pred.home, away: pred.away }
    punten[playerId] = berekenPunten(pred, uitslag)
    toto[playerId] = totoLabel(pred)
  }

  const totals = await kvGet('totals') || {}
  const nieuweTotals = { ...totals }
  for (const [playerId, p] of Object.entries(punten)) {
    nieuweTotals[playerId] = (nieuweTotals[playerId] || 0) + p
  }

  const totalen = {}
  for (const playerId of Object.keys(punten)) {
    totalen[playerId] = nieuweTotals[playerId]
  }

  const result = {
    matchId, uitslag, volgnummer: fixture.volgnummer,
    predicties, toto, punten, totalen,
    datumISO: fixture.datumISO, datum: fixture.datum,
    competitie: fixture.competitie, thuis: fixture.thuis, uit: fixture.uit,
    verwerktOp: new Date().toISOString(),
  }

  await kvSet(`result:${matchId}`, result)
  await kvSet('totals', nieuweTotals)

  const index = await kvGet('results:index') || []
  if (!index.includes(String(matchId))) {
    index.push(String(matchId))
    await kvSet('results:index', index)
  }
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

    await verwerkUitslag(f, f.uitslag)
  }
}
