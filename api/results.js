import { kvGet } from './_kv.js'
import { zoekVolgnummer, berekenEnSlaResultaatOp } from './_wedstrijden.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method === 'GET' && req.query.all) {
    const matchIds = await kvGet('results:index') || []
    const ruweResults = (await Promise.all(matchIds.map(id => kvGet(`result:${id}`)))).filter(Boolean)

    // Lopend totaal altijd herberekenen in chronologische volgorde (op
    // volgnummer), ongeacht de volgorde waarin uitslagen in Admin zijn
    // ingevoerd. Zo blijft de reeks per speler gegarandeerd oplopend.
    const chronologisch = [...ruweResults].sort((a, b) => (a.volgnummer || 0) - (b.volgnummer || 0))
    const lopendTotaal = {}

    for (const r of chronologisch) {
      const nieuweTotalen = { ...(r.totalen || {}) }
      for (const playerId of Object.keys(r.punten || {})) {
        lopendTotaal[playerId] = (lopendTotaal[playerId] || 0) + (r.punten[playerId] || 0)
        nieuweTotalen[playerId] = lopendTotaal[playerId]
      }
      r.totalen = nieuweTotalen
    }

    return res.status(200).json({
      totals: lopendTotaal,
      results: chronologisch.slice().sort((a, b) => (b.volgnummer || 0) - (a.volgnummer || 0))
    })
  }

  if (req.method === 'GET') {
    const { matchId } = req.query
    if (!matchId) return res.status(400).json({ error: 'matchId verplicht' })
    const result = await kvGet(`result:${matchId}`)
    return res.status(200).json({ result })
  }

  if (req.method === 'POST') {
    let body = req.body
    if (typeof body === 'string') { try { body = JSON.parse(body) } catch (_) {} }
    const { matchId, homeScore, awayScore, matchInfo } = body || {}
    if (!matchId || homeScore === undefined || awayScore === undefined) {
      return res.status(400).json({ error: 'matchId, homeScore en awayScore verplicht' })
    }
    const uitslag = { home: parseInt(homeScore), away: parseInt(awayScore) }
    const volgnummer = await zoekVolgnummer(matchId)

    const result = await berekenEnSlaResultaatOp({
      matchId,
      volgnummer,
      datumISO: matchInfo?.datumISO || new Date().toISOString(),
      datum: matchInfo?.datum || '',
      competitie: matchInfo?.competitie || '',
      thuis: matchInfo?.thuis || '',
      uit: matchInfo?.uit || '',
    }, uitslag)

    return res.status(200).json({ success: true, result, totals: result.totalen })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
