import { kvGet, kvSet } from './_kv.js'

const API_KEY  = process.env.API_FOOTBALL_KEY
const API_BASE = 'https://v3.football.api-sports.io'

function competitieNaam(naam) {
  if (naam.includes('Eredivisie')) return 'ERE'
  if (naam.includes('KNVB')) return 'KNVB'
  if (naam.includes('Champions')) return 'CL'
  if (naam.includes('Europa')) return 'UL'
  if (naam.includes('Conference')) return 'UL'
  if (naam.includes('Cruijff')) return 'JCS'
  return naam.substring(0,4).toUpperCase()
}

function formatDatum(dateStr) {
  const d = new Date(dateStr)
  const maanden = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']
  return `${d.getDate()} ${maanden[d.getMonth()]} ${d.getFullYear()}`
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  const { home, away } = req.query
  if (!home || !away) return res.status(400).json({ error: 'home en away verplicht' })

  const CACHE_KEY = `h2h:${home}:${away}`
  const cached = await kvGet(CACHE_KEY)
  if (cached?.cached_at) {
    const ageH = (Date.now() - new Date(cached.cached_at).getTime()) / 3600000
    if (ageH < 24) return res.status(200).json({ source: 'cache', h2h: cached.h2h })
  }

  if (!API_KEY) return res.status(500).json({ error: 'API_FOOTBALL_KEY niet ingesteld' })

  try {
    const url = `${API_BASE}/fixtures/headtohead?h2h=${home}-${away}&last=3`
    const r = await fetch(url, headers: { 
      'x-rapidapi-key': API_KEY,
      'x-rapidapi-host': 'v3.football.api-sports.io'
    })
    const data = await r.json()
    const fixtures = data.response || []
    const h2h = fixtures
      .filter(f => ['FT','AET'].includes(f.fixture.status.short))
      .slice(0,3)
      .map(f => ({
        datum: formatDatum(f.fixture.date),
        thuis: f.teams.home.name,
        uit: f.teams.away.name,
        uitslag: `${f.score.fulltime.home}-${f.score.fulltime.away}`,
        competitie: competitieNaam(f.league.name),
      }))
    const payload = { h2h, cached_at: new Date().toISOString() }
    await kvSet(CACHE_KEY, payload, 60 * 60 * 24)
    return res.status(200).json({ source: 'fetched', h2h })
  } catch (err) {
    if (cached) return res.status(200).json({ source: 'cache-fallback', h2h: cached.h2h })
    return res.status(500).json({ error: err.message })
  }
}
