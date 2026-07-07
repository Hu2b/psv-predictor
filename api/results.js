import { kvGet, kvSet } from './_kv.js'
import { berekenPunten, totoLabel } from './_scoring.js'
import { zoekVolgnummer } from './_wedstrijden.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method === 'GET' && req.query.all) {
    const totals = await kvGet('totals') || {}
    const matchIds = await kvGet('results:index') || []
    const results = await Promise.all(matchIds.map(id => kvGet(`result:${id}`)))
    return res.status(200).json({
      totals,
      results: results.filter(Boolean).sort((a,b) => new Date(b.datumISO) - new Date(a.datumISO))
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

    const [predictionIndex, volgnummer] = await Promise.all([
      kvGet(`predictionIndex:${matchId}`),
      zoekVolgnummer(matchId),
    ])
    const spelersMetVoorspelling = predictionIndex || []
    const predicties = {}
    const punten = {}
    const toto = {}

    for (const playerId of spelersMetVoorspelling) {
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
    for (const playerId of Object.keys(punten)) totalen[playerId] = nieuweTotals[playerId]

    const result = {
      matchId, uitslag, volgnummer,
      predicties, toto, punten, totalen,
      datumISO: matchInfo?.datumISO || new Date().toISOString(),
      datum: matchInfo?.datum || '', competitie: matchInfo?.competitie || '',
      thuis: matchInfo?.thuis || '', uit: matchInfo?.uit || '',
      verwerktOp: new Date().toISOString(),
    }
    await kvSet(`result:${matchId}`, result)
    await kvSet('totals', nieuweTotals)
    const index = await kvGet('results:index') || []
    if (!index.includes(String(matchId))) {
      index.push(String(matchId))
      await kvSet('results:index', index)
    }
    return res.status(200).json({ success: true, result, totals: nieuweTotals })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
