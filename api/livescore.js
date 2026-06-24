import { kvGet, kvSet } from './_kv.js'

const API_KEY  = process.env.API_FOOTBALL_KEY
const API_BASE = 'https://v3.football.api-sports.io'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  const { matchId } = req.query
  if (!matchId) return res.status(400).json({ error: 'matchId verplicht' })

  const CACHE_KEY = `livescore:${matchId}`
  const cached = await kvGet(CACHE_KEY)
  if (cached?.cached_at) {
    const ageMin = (Date.now() - new Date(cached.cached_at).getTime()) / 60000
    if (ageMin < 2) return res.status(200).json({ source: 'cache', ...cached })
  }

  if (!API_KEY) return res.status(500).json({ error: 'API_FOOTBALL_KEY niet ingesteld' })

  try {
    const url = `${API_BASE}/fixtures?id=${matchId}`
    const r = await fetch(url, {
      headers: { 
        'x-rapidapi-key': API_KEY,
        'x-rapidapi-host': 'v3.football.api-sports.io'
    }
    })
    const data = await r.json()
    const f = data.response?.[0]
    if (!f) return res.status(404).json({ error: 'Wedstrijd niet gevonden' })

    const status = f.fixture.status.short
    const isAfgelopen = ['FT','AET','PEN'].includes(status)
    const isBezig = ['1H','HT','2H','ET','BT','LIVE'].includes(status)
    const score = isAfgelopen
      ? { home: f.score.fulltime.home, away: f.score.fulltime.away }
      : isBezig
      ? { home: f.goals.home ?? 0, away: f.goals.away ?? 0 }
      : null

    const payload = {
      matchId, status, isAfgelopen, isBezig, score,
      minuut: f.fixture.status.elapsed,
      cached_at: new Date().toISOString(),
    }
    await kvSet(CACHE_KEY, payload, isAfgelopen ? 3600 : 120)
    return res.status(200).json({ source: 'fetched', ...payload })
  } catch (err) {
    if (cached) return res.status(200).json({ source: 'cache-fallback', ...cached })
    return res.status(500).json({ error: err.message })
  }
}
