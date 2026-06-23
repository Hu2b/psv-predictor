import { kvGet, kvSet } from './_kv.js'

function berekenPunten(pred, uitslag) {
  if (!pred || !uitslag) return 0
  const predToto = Math.sign(pred.home - pred.away)
  const uitsToto = Math.sign(uitslag.home - uitslag.away)
  if (predToto !== uitsToto) return 0
  let punten = 5
  const homeExact = pred.home === uitslag.home
  const awayExact = pred.away === uitslag.away
  if (homeExact && awayExact) punten += 5
  else if (homeExact || awayExact) punten += 2
  return punten
}

function totoLabel(pred) {
  if (!pred) return null
  const diff = pred.home - pred.away
  if (diff > 0) return '1'
  if (diff < 0) return '2'
  return 'X'
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method === 'GET' && req.query.all) {
    const totals = await kvGet('totals') || { niek: 0, huub: 0 }
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
    if (typeof body === 'string') {
      try { body = JSON.parse(body) } catch (_) {}
    }
    const { matchId, homeScore, awayScore, matchInfo } = body || {}
    if (!matchId || homeScore === undefined || awayScore === undefined) {
      return res.status(400).json({ error: 'matchId, homeScore en awayScore verplicht' })
    }
    const uitslag = { home: parseInt(homeScore), away: parseInt(awayScore) }
    const [predNiek, predHuub] = await Promise.all([
      kvGet(`prediction:${matchId}:niek`),
      kvGet(`prediction:${matchId}:huub`),
    ])
    const puntNiek = berekenPunten(predNiek, uitslag)
    const puntHuub = berekenPunten(predHuub, uitslag)
    const totals = await kvGet('totals') || { niek: 0, huub: 0 }
    const nieuweTotals = { niek: totals.niek + puntNiek, huub: totals.huub + puntHuub }
    const result = {
      matchId, uitslag,
      predNiek: predNiek ? { home: predNiek.home, away: predNiek.away } : null,
      predHuub: predHuub ? { home: predHuub.home, away: predHuub.away } : null,
      totoNiek: totoLabel(predNiek), totoHuub: totoLabel(predHuub),
      puntNiek, puntHuub,
      totaalNiek: nieuweTotals.niek, totaalHuub: nieuweTotals.huub,
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
