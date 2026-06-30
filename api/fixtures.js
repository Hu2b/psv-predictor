import { kvGet, kvSet } from './_kv.js'

const API_KEY    = process.env.FOOTBALL_DATA_KEY
const API_BASE   = 'https://api.football-data.org/v4'
const CACHE_KEY  = 'psv:fixtures:fd'
const CACHE_TTL  = 60 * 30

// Eredivisie en Champions League zijn gratis beschikbaar
// KNVB Beker en Johan Cruijff Schaal zijn niet beschikbaar op football-data.org gratis tier
const COMPETITIONS = {
  DED: 'ERE',
  CL:  'CL',
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
    'PSV Eindhoven':'PSV','PSV':'PSV','Ajax':'AJX','AFC Ajax':'AJX',
    'Feyenoord':'FEY','Feyenoord Rotterdam':'FEY',
    'AZ':'AZ ','AZ Alkmaar':'AZ ','FC Utrecht':'UTR','FC Twente':'TWE',
    'FC Twente Enschede':'TWE','Vitesse':'VIT','NEC':'NEC','NEC Nijmegen':'NEC',
    'sc Heerenveen':'HEE','FC Groningen':'GRO','Almere City FC':'ALM',
    'Sparta Rotterdam':'SPA','Go Ahead Eagles':'GAE','RKC Waalwijk':'RKC',
    'PEC Zwolle':'PEC','Fortuna Sittard':'FOR','Willem II':'WIL',
    'NAC Breda':'NAC','Heracles Almelo':'HER','Excelsior':'EXC',
    'SC Cambuur':'CAM','FC Volendam':'VOL',
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
  const url = `${API_BASE}/competitions/${code}/matches?season=2025`
  const res = await fetch(url, {
    headers: { 'X-Auth-Token': API_KEY }
  })
  const data = await res.json()
  if (data.error || data.errorCode) {
    console.error(`football-data.org error for ${code}:`, JSON.stringify(data))
    return []
  }
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  const cached = await kvGet(CACHE_KEY)
  if (cached?.cached_at) {
    const ageMin = (Date.now() - new Date(cached.cached_at).getTime()) / 60000
    if (ageMin < CACHE_TTL / 60) return res.status(200).json({ source: 'cache', fixtures: cached.fixtures })
  }

  if (!API_KEY) return res.status(500).json({ error: 'FOOTBALL_DATA_KEY niet ingesteld' })

  try {
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
    await kvSet(CACHE_KEY, payload, CACHE_TTL)

    return res.status(200).json({ source: 'fetched', fixtures: allFixtures })
  } catch (err) {
    if (cached) return res.status(200).json({ source: 'cache-fallback', fixtures: cached.fixtures })
    return res.status(500).json({ error: err.message })
  }
}
