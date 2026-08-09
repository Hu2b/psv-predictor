import { kvGet, kvSet } from './_kv.js'

// Ook dit endpoint draait nu op football-data.org. De oude versie stuurde
// team-id's van football-data.org naar api-sports.io, dat een eigen
// nummering hanteert — daardoor kwamen er ontmoetingen van willekeurig
// andere clubs terug, of helemaal niets. football-data.org heeft een
// head2head-subresource op de wedstrijd zelf, dus we hoeven alleen het
// matchId door te geven dat we toch al hebben.
const API_KEY = process.env.FOOTBALL_DATA_KEY
const API_BASE = 'https://api.football-data.org/v4'

function competitieAfkorting(naam = '') {
  if (naam.includes('Eredivisie')) return 'ERE'
  if (naam.includes('KNVB')) return 'KNVB'
  if (naam.includes('Champions')) return 'CL'
  if (naam.includes('Europa')) return 'UL'
  if (naam.includes('Conference')) return 'UL'
  if (naam.includes('Cruijff') || naam.includes('Super Cup')) return 'JCS'
  return naam.substring(0, 4).toUpperCase()
}

function formatDatum(dateStr) {
  const d = new Date(dateStr)
  const maanden = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']
  return `${d.getDate()} ${maanden[d.getMonth()]} ${d.getFullYear()}`
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  const { matchId } = req.query
  if (!matchId) return res.status(400).json({ error: 'matchId verplicht' })

  const CACHE_KEY = `h2h:v2:${matchId}`
  const cached = await kvGet(CACHE_KEY)
  if (cached?.cached_at) {
    const ageH = (Date.now() - new Date(cached.cached_at).getTime()) / 3600000
    if (ageH < 24) return res.status(200).json({ source: 'cache', h2h: cached.h2h })
  }

  if (!API_KEY) return res.status(500).json({ error: 'FOOTBALL_DATA_KEY niet ingesteld' })

  try {
    const r = await fetch(`${API_BASE}/matches/${matchId}/head2head?limit=5`, {
      headers: { 'X-Auth-Token': API_KEY },
    })
    const data = await r.json()

    if (!r.ok || data.errorCode) {
      if (cached) return res.status(200).json({ source: 'cache-fallback', h2h: cached.h2h })
      return res.status(200).json({ h2h: [] })
    }

    const h2h = (data.matches || [])
      .filter(m => m.status === 'FINISHED')
      .sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate))
      .slice(0, 3)
      .map(m => ({
        datum: formatDatum(m.utcDate),
        thuis: m.homeTeam?.shortName || m.homeTeam?.name || '?',
        uit: m.awayTeam?.shortName || m.awayTeam?.name || '?',
        uitslag: `${m.score?.fullTime?.home ?? '-'}-${m.score?.fullTime?.away ?? '-'}`,
        competitie: competitieAfkorting(m.competition?.name),
      }))

    await kvSet(CACHE_KEY, { h2h, cached_at: new Date().toISOString() }, 60 * 60 * 24)
    return res.status(200).json({ source: 'fetched', h2h })
  } catch (err) {
    if (cached) return res.status(200).json({ source: 'cache-fallback', h2h: cached.h2h })
    return res.status(500).json({ error: err.message })
  }
}
