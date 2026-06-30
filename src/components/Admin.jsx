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

  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch (_) {} }
  const { action } = body || req.query

  if (req.method === 'GET' && req.query.action === 'wedstrijden') {
    const wedstrijden = await kvGet('admin:wedstrijden') || []
    return res.status(200).json({ wedstrijden })
  }

  if (req.method === 'POST' && action === 'toevoegen') {
    const { competitie, thuis, thuisNaam, uit, uitNaam, datum, datumISO } = body
    if (!competitie || !thuis || !uit || !datumISO) {
      return res.status(400).json({ error: 'competitie, thuis, uit en datumISO zijn verplicht' })
    }
    const wedstrijden = await kvGet('admin:wedstrijden') || []
    const matchId = `manual_${Date.now()}`
    const nieuw = {
      matchId, competitie,
      thuis, thuisNaam: thuisNaam || thuis,
      uit, uitNaam: uitNaam || uit,
      datum, datumISO,
      status: 'NS',
      uitslag: null,
      handmatig: true,
      volgnummer: 999,
    }
    wedstrijden.push(nieuw)
    await kvSet('admin:wedstrijden', wedstrijden)
    return res.status(200).json({ success: true, wedstrijd: nieuw })
  }

  if (req.method === 'POST' && action === 'wijzigen') {
    const { matchId, competitie, thuis, thuisNaam, uit, uitNaam, datum, datumISO } = body
    if (!matchId) return res.status(400).json({ error: 'matchId verplicht' })
    const wedstrijden = await kvGet('admin:wedstrijden') || []
    const idx = wedstrijden.findIndex(w => w.matchId === matchId)
    if (idx === -1) return res.status(404).json({ error: 'Wedstrijd niet gevonden' })
    wedstrijden[idx] = {
      ...wedstrijden[idx],
      competitie: competitie || wedstrijden[idx].competitie,
      thuis: thuis || wedstrijden[idx].thuis,
      thuisNaam: thuisNaam || wedstrijden[idx].thuisNaam,
      uit: uit || wedstrijden[idx].uit,
      uitNaam: uitNaam || wedstrijden[idx].uitNaam,
      datum: datum || wedstrijden[idx].datum,
      datumISO: datumISO || wedstrijden[idx].datumISO,
    }
    await kvSet('admin:wedstrijden', wedstrijden)
    return res.status(200).json({ success: true, wedstrijd: wedstrijden[idx] })
  }

  if (req.method === 'POST' && action === 'verwijderen') {
    const { matchId } = body
    if (!matchId) return res.status(400).json({ error: 'matchId verplicht' })
    const wedstrijden = await kvGet('admin:wedstrijden') || []
    const nieuw = wedstrijden.filter(w => w.matchId !== matchId)
    await kvSet('admin:wedstrijden', nieuw)
    return res.status(200).json({ success: true })
  }

  if (req.method === 'POST' && action === 'uitslag') {
    const { matchId, homeScore, awayScore, matchInfo } = body
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
    const vorigeResult = await kvGet(`result:${matchId}`)
    const totals = await kvGet('totals') || { niek: 0, huub: 0 }
    const vorigeNiek = vorigeResult?.puntNiek || 0
    const vorigeHuub = vorigeResult?.puntHuub || 0
    const nieuweTotals = {
      niek: totals.niek - vorigeNiek + puntNiek,
      huub: totals.huub - vorigeHuub + puntHuub,
    }
    const result = {
      matchId, uitslag,
      predNiek: predNiek ? { home: predNiek.home, away: predNiek.away } : null,
      predHuub: predHuub ? { home: predHuub.home, away: predHuub.away } : null,
      totoNiek: totoLabel(predNiek), totoHuub: totoLabel(predHuub),
      puntNiek, puntHuub,
      totaalNiek: nieuweTotals.niek, totaalHuub: nieuweTotals.huub,
      datumISO: matchInfo?.datumISO || new Date().toISOString(),
      datum: matchInfo?.datum || '',
      competitie: matchInfo?.competitie || '',
      thuis: matchInfo?.thuis || '',
      uit: matchInfo?.uit || '',
      verwerktOp: new Date().toISOString(),
    }
    await kvSet(`result:${matchId}`, result)
    await kvSet('totals', nieuweTotals)
    const index = await kvGet('results:index') || []
    if (!index.includes(String(matchId))) {
      index.push(String(matchId))
      await kvSet('results:index', index)
    }
    const wedstrijden = await kvGet('admin:wedstrijden') || []
    const idx = wedstrijden.findIndex(w => w.matchId === matchId)
    if (idx !== -1) {
      wedstrijden[idx].uitslag = uitslag
      wedstrijden[idx].status = 'FT'
      await kvSet('admin:wedstrijden', wedstrijden)
    }
    return res.status(200).json({ success: true, result, totals: nieuweTotals, punten: { niek: puntNiek, huub: puntHuub } })
  }

  return res.status(400).json({ error: 'Onbekende actie' })
}
