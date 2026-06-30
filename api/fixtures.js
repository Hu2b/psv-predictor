import { kvGet, kvSet } from './_kv.js'

const API_KEY    = process.env.API_FOOTBALL_KEY
const API_BASE   = 'https://v3.football.api-sports.io'
const PSV_ID     = 673
const SEASON     = parseInt(process.env.PSV_SEASON || '2026')
const CACHE_KEY  = `psv:fixtures:${SEASON}`
const CACHE_TTL  = 60 * 5

const COMPETITIONS = {
  88:  'ERE',
  90:  'KNVB',
  2:   'CL',
  3:   'UL',
  848: 'UL',
  531: 'JCS',
  760: 'ERE',
}

function dagAfkorting(dateStr) {
  const d = new Date(dateStr)
  const dagen = ['zo','ma','di','wo','do','vr','za']
  return dagen[d.getDay()]
}

function formatDatum(dateStr) {
  const d = new Date(dateStr)
  const maanden = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']
  return `${dagAfkorting(dateStr)} ${d.getDate()} ${maanden[d.getMonth()]}`
}

function teamAfkorting(naam) {
  const mapping = {
    'PSV Eindhoven':'PSV','PSV':'PSV','Ajax':'AJX','Feyenoord':'FEY',
    'AZ':'AZ ','Utrecht':'UTR','Twente':'TWE','Vitesse':'VIT','NEC':'NEC',
    'Heerenveen':'HEE','Groningen':'GRO','Almere City':'ALM',
    'Sparta Rotterdam':'SPA','Go Ahead Eagles':'GAE','RKC Waalwijk':'RKC',
    'PEC Zwolle':'PEC','Fortuna Sittard':'FOR','Willem II':'WIL',
    'NAC Breda':'NAC','Heracles':'HER','Excelsior':'EXC','Cambuur':'CAM',
  }
  if (mapping[naam]) return mapping[naam]
  return naam.replace(/[^a-zA-Z]/g,'').substring(0,3).toUpperCase()
}

async function fetchFromAPI(leagueId) {
  const url = `${API_BASE}/fixtures?team=${PSV_ID}&league=${leagueId}&season=${SEASON}`
  const res = await fetch(url, {
    headers: { 
      'x-apisports-key': API_KEY,
      'x-rapidapi-key': API_KEY,
      'x-rapidapi-host': 'v3.football.api-sports.io'
    }
  })
  const data = await res.json()
  if (data.errors && Object.keys(data.errors).length > 0) {
    console.error('API-Football errors:', JSON.stringify(data.errors))
  }
  return { fixtures: data.response || [], errors: data.errors || {}, results: data.results }
}

function mapFixture(f, comp) {
  const home = f.teams.home
  const away = f.teams.away
  const score = f.score
  const status = f.fixture.status.short
  let uitslag = null
  if (['FT','AET','PEN'].includes(status)) {
    uitslag = { home: score.fulltime.home, away: score.fulltime.away, status: 'FT' }
  } else if (['1H','HT','2H','ET','BT'].includes(status)) {
    uitslag = { home: score.halftime.home ?? 0, away: score.halftime.away ?? 0, status: 'LIVE' }
  }
  return {
    matchId: f.fixture.id, competitie: comp,
    thuis: teamAfkorting(home.name), thuisNaam: home.name, thuisLogo: home.logo, thuisId: home.id,
    uit: teamAfkorting(away.name), uitNaam: away.name, uitLogo: away.logo, uitId: away.id,
    dag: dagAfkorting(f.fixture.date), datum: formatDatum(f.fixture.date),
    datumISO: f.fixture.date, status, uitslag,
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  const cached = await kvGet(CACHE_KEY)
  if (cached?.cached_at) {
    const ageMin = (Date.now() - new Date(cached.cached_at).getTime()) / 60000
    if (ageMin < CACHE_TTL / 60) return res.status(200).json({ source: 'cache', fixtures: cached.fixtures })
  }

  if (!API_KEY) return res.status(500).json({ error: 'API_FOOTBALL_KEY niet ingesteld' })

  try {
    const leagueIds = Object.keys(COMPETITIONS)
    const results = await Promise.allSettled(
      leagueIds.map(async (leagueId) => {
        const comp = COMPETITIONS[leagueId]
        const { fixtures, errors, results: apiResults } = await fetchFromAPI(leagueId)
        return { mapped: fixtures.map(f => mapFixture(f, comp)), errors, apiResults }
      })
    )

    let allFixtures = []
    for (const r of results) {
      if (r.status === 'fulfilled') allFixtures = allFixtures.concat(r.value.mapped)
    }
    const seen = new Set()
    allFixtures = allFixtures.filter(f => {
      if (seen.has(f.matchId)) return false
      seen.add(f.matchId); return true
    })
    allFixtures.sort((a, b) => new Date(a.datumISO) - new Date(b.datumISO))
    allFixtures = allFixtures.map((f, i) => ({ ...f, volgnummer: i + 1 }))

    const payload = { fixtures: allFixtures, cached_at: new Date().toISOString() }
    await kvSet(CACHE_KEY, payload, CACHE_TTL)

    const debugInfo = results.map((r, i) => ({
      league: leagueIds[i],
      status: r.status,
      reason: r.status === 'rejected' ? r.reason?.message : undefined,
      count: r.status === 'fulfilled' ? r.value.mapped.length : 0,
      apiResults: r.status === 'fulfilled' ? r.value.apiResults : undefined,
      errors: r.status === 'fulfilled' ? r.value.errors : undefined,
    }))

    return res.status(200).json({ source: 'fetched', fixtures: allFixtures, debug: debugInfo, season: SEASON })
  } catch (err) {
    if (cached) return res.status(200).json({ source: 'cache-fallback', fixtures: cached.fixtures })
    return res.status(500).json({ error: err.message })
  }
}
