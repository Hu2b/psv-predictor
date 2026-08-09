import { kvGet, kvSet } from './_kv.js'
import { zetCors } from './_cors.js'

// Let op: dit endpoint gebruikt football-data.org, NIET api-sports.io.
// De matchId's in deze app komen uit de wedstrijdenlijst van
// football-data.org (_wedstrijden.js -> mapMatch -> m.id). Die id's bestaan
// niet in de nummering van api-sports.io, dus de oude implementatie vroeg
// daar een compleet andere (of niet-bestaande) wedstrijd op. Door dezelfde
// bron te gebruiken als de wedstrijdenlijst kan die verwarring niet meer
// ontstaan en is er nog maar één API-sleutel nodig.
const API_KEY = process.env.FOOTBALL_DATA_KEY
const API_BASE = 'https://api.football-data.org/v4'

const AFGELOPEN_STATUS = ['FINISHED', 'AWARDED']
const BEZIG_STATUS = ['IN_PLAY', 'PAUSED']

export default async function handler(req, res) {
  zetCors(res, 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()
  const { matchId } = req.query
  if (!matchId) return res.status(400).json({ error: 'matchId verplicht' })

  const CACHE_KEY = `livescore:${matchId}`
  const cached = await kvGet(CACHE_KEY)
  if (cached?.cached_at) {
    const ageMin = (Date.now() - new Date(cached.cached_at).getTime()) / 60000
    if (ageMin < 2) return res.status(200).json({ source: 'cache', ...cached })
  }

  if (!API_KEY) return res.status(500).json({ error: 'FOOTBALL_DATA_KEY niet ingesteld' })

  try {
    const r = await fetch(`${API_BASE}/matches/${matchId}`, {
      headers: { 'X-Auth-Token': API_KEY },
    })
    const data = await r.json()

    if (!r.ok || data.errorCode || !data.status) {
      if (cached) return res.status(200).json({ source: 'cache-fallback', ...cached })
      return res.status(404).json({ error: 'Wedstrijd niet gevonden' })
    }

    const status = data.status
    const isAfgelopen = AFGELOPEN_STATUS.includes(status)
    const isBezig = BEZIG_STATUS.includes(status)

    // Bij football-data.org bevat score.fullTime tijdens een lopende
    // wedstrijd de actuele stand; pas na afloop is het de definitieve
    // eindstand. null betekent "nog niet begonnen", niet 0-0.
    const home = data.score?.fullTime?.home
    const away = data.score?.fullTime?.away
    const heeftStand = home !== null && home !== undefined && away !== null && away !== undefined

    const score = (isAfgelopen || isBezig) && heeftStand
      ? { home, away }
      : isBezig
      ? { home: 0, away: 0 }
      : null

    const payload = {
      matchId,
      status,
      isAfgelopen,
      isBezig,
      score,
      minuut: data.minute ?? null,
      cached_at: new Date().toISOString(),
    }

    // Een eindstand verandert niet meer: een uur cachen. Een lopende
    // wedstrijd korter, zodat de stand actueel blijft binnen de limiet van
    // 10 aanroepen per minuut op de gratis laag.
    await kvSet(CACHE_KEY, payload, isAfgelopen ? 3600 : 120)
    return res.status(200).json({ source: 'fetched', ...payload })
  } catch (err) {
    if (cached) return res.status(200).json({ source: 'cache-fallback', ...cached })
    return res.status(500).json({ error: err.message })
  }
}
