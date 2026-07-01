import { kvGet, kvSet } from './_kv.js'

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

const SEASON = parseInt(process.env.PSV_SEASON || String(bepaalSeizoen()))
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

function teamAfkorting(naam) {
  const mapping = {
    'PSV Eindhoven':'PSV','PSV':'PSV','Ajax':'AJX','AFC Ajax':'AJX',
    'Feyenoord':'FEY','Feyenoord Rotterdam':'FEY',
    'AZ':'AZ ','AZ Alkmaar':'AZ ','FC Utrecht':'UTR','FC Twente':'TWE',
    'FC Twente Enschede':'TWE','NEC':'NEC','NEC Nijmegen':'NEC',
    'sc Heerenveen':'HEE','FC Groningen':'GRO','Almere City FC':'ALM',
    'Sparta Rotterdam':'SPA','Go Ahead Eagles':'GAE','RKC Waalwijk':'RKC',
    'PEC Zwolle':'PEC','Fortuna Sittard':'FOR','Willem II':'WIL',
    'NAC Breda':'NAC','Heracles Almelo':'HER','Excelsior':'EXC',
    'SC Cambuur':'CAM','FC Volendam':'VOL','Telstar 1963':'TEL',
    'SBV Excelsior':'SBV','ADO Den Haag':'ADO',
  }
  if (mapping[naam]) return mapping[naam]
  return naam.replace(/[^a-zA-Z]/g,'').substring(0,3).toUpperCase()
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
    thuis: teamAfkorting(m.homeTeam.name), thuisNaam: m.homeTeam.name,
    thuisLogo: m.homeTeam.crest, thuisId: m.homeTeam.id,
    uit: teamAfkorting(m.awayTeam.name), uitNaam: m.awayTeam.name,
    uitLogo: m.awayTeam.crest, uitId: m.awayTeam.id,
    dag: dagAfkorting(m.utcDate), datum: formatDatum(m.utcDate),
    datumISO: m.utcDate, status, uitslag,
  }
}

function berekenPunten(pred, uitslag) {
  if (!pred || !uitslag) return 0
  const predToto = Math.sign(pred.home - pred.away)
  const uitsToto = Math.sign(uitslag.home - uitslag.away)
  if (predToto !== uitsToto) return 0
  let punten = 5
  if (pred.home === uitslag.home && pred.away === uitslag.away) punten += 5
  else if (pred.home === uitslag.home || pred.away === uitslag.away) punten += 2
  return punten
}

function totoLabel(pred) {
  if (!pred) return null
  const diff = pred.home - pred.away
  if (diff > 0) return '1'
  if (diff < 0) return '2'
  return 'X'
}

async function verwerkUitslag(fixture, uitslag) {
  const matchId = fixture.matchId
  const bestaand = await kvGet(`result:${matchId}`)
  if (bestaand) return // Al verwerkt

  const [predNiek, predHuub] = await Promise.all([
    kvGet(`prediction:${matchId}:niek`),
    kvGet(`prediction:${matchId}:huub`),
  ])

  const puntNiek = berekenPunten(predNiek, uitslag)
  const puntHuub = berekenPunten(predHuub, uitslag)
  const totals = await kvGet('totals') || { niek: 0, huub: 0 }

  const nieuweTotals = {
    niek: totals.niek + puntNiek,
    huub: totals.huub + puntHuub,
  }

  const result = {
    matchId, uitslag,
    predNiek: predNiek ? { home: predNiek.home, away: predNiek.away } : null,
    predHuub: predHuub ? { home: predHuub.home, away: predHuub.away } : null,
    totoNiek: totoLabel(predNiek), totoHuub: totoLabel(predHuub),
    puntNiek, puntHuub,
    totaalNiek: nieuweTotals.niek, totaalHuub: nieuweTotals.huub,
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

async function checkEnSlaUitslagenOp(fixtures) {
  const nu = Date.now()
  const MIN_135 = 135 * 60 * 1000

  for (const f of fixtures) {
    if (f.status === 'NS') continue // Nog niet gespeeld
    if (!f.uitslag || f.uitslag.status !== 'FT') continue // Geen eindstand

    const wedstrijdTijd = new Date(f.datumISO).getTime()
    if (nu - wedstrijdTijd < MIN_135) continue // Nog geen 135 min verstreken

    const bestaand = await kvGet(`result:${f.matchId}`)
    if (bestaand) continue // Al verwerkt

    await verwerkUitslag(f, f.uitslag)
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  try {
    const datumKey = getNLDatumKey()
    const venster = getTijdvenster()
    const cacheKey = `psv:fixtures:fd:${SEASON}:${datumKey}:v${venster}`
    const fallbackKey = `psv:fixtures:fd:${SEASON}:latest`

    // Buiten tijdvensters: gebruik laatste cache
    if (venster === 0) {
      const cached = await kvGet(fallbackKey)
      if (cached?.fixtures) {
        return res.status(200).json({ source: 'cache-buiten-venster', fixtures: cached.fixtures, season: SEASON })
      }
    }

    // Venster al gecached: gebruik cache
    const vensterCache = await kvGet(cacheKey)
    if (vensterCache?.fixtures) {
      return res.status(200).json({ source: `cache-venster-${venster}`, fixtures: vensterCache.fixtures, season: SEASON })
    }

    if (!API_KEY) return res.status(500).json({ error: 'FOOTBALL_DATA_KEY niet ingesteld' })

    const PSV_NAMES = ['PSV', 'PSV Eindhoven']
    let allFixtures = []

    for (const [code, comp] of Object.entries(COMPETITIONS)) {
      const matches = await fetchCompetitionMatches(code)
      const psvMatches = matches.filter(m =>
        PSV_NAMES.includes(m.homeTeam.name) || PSV_NAMES.includes(m.awayTeam.name)
      )
      allFixtures = allFixtures.concat(psvMatches.map(m => mapMatch(m, comp)))
    }

    const seen = new Set()
    allFixtures = allFixtures.filter(f => {
      if (seen.has(f.matchId)) return false
      seen.add(f.matchId); return true
    })
    allFixtures.sort((a, b) => new Date(a.datumISO) - new Date(b.datumISO))
    allFixtures = allFixtures.map((f, i) => ({ ...f, volgnummer: i + 1 }))

    const payload = { fixtures: allFixtures, cached_at: new Date().toISOString() }
    await kvSet(cacheKey, payload)
    await kvSet(fallbackKey, payload)

    // Verwerk uitslagen op achtergrond
    checkEnSlaUitslagenOp(allFixtures).catch(e => console.error('uitslag fout:', e))

    return res.status(200).json({ source: `fetched-venster-${venster}`, fixtures: allFixtures, season: SEASON })
  } catch (err) {
    console.error('Fixtures handler error:', err)
    try {
      const fallbackKey = `psv:fixtures:fd:${SEASON}:latest`
      const cached = await kvGet(fallbackKey)
      if (cached) return res.status(200).json({ source: 'cache-fallback', fixtures: cached.fixtures, season: SEASON })
    } catch (_) {
      // fallback-lookup faalde ook, val door naar 500 hieronder
    }
    return res.status(500).json({ error: err.message })
  }
}
