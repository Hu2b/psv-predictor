import { kvGet, kvSet } from './_kv.js'
import { berekenPunten, totoLabel } from './_scoring.js'
import { zoekVolgnummer } from './_wedstrijden.js'
import { getPlayerById } from './_players.js'

async function slaHandmatigOp(wedstrijden) {
  await kvSet('admin:wedstrijden', wedstrijden)
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

  if (req.method === 'GET' && req.query.action === 'voorspellingen') {
    const { matchId } = req.query
    if (!matchId) return res.status(400).json({ error: 'matchId verplicht' })
    const index = await kvGet(`predictionIndex:${matchId}`) || []
    const predicties = await Promise.all(index.map(async playerId => {
      const pred = await kvGet(`prediction:${matchId}:${playerId}`)
      if (!pred) return null
      const speler = await getPlayerById(playerId)
      return { playerId, naam: speler?.naam || '???', home: pred.home, away: pred.away, confirmed: pred.confirmed }
    }))
    return res.status(200).json({ predicties: predicties.filter(Boolean) })
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
      status: 'NS', uitslag: null,
      handmatig: true,
    }
    wedstrijden.push(nieuw)
    await slaHandmatigOp(wedstrijden)
    return res.status(200).json({ success: true, wedstrijd: nieuw })
  }

  if (req.method === 'POST' && action === 'wijzigen') {
    const { matchId, competitie, thuis, thuisNaam, uit, uitNaam, datum, datumISO } = body
    if (!matchId) return res.status(400).json({ error: 'matchId verplicht' })
    const wedstrijden = await kvGet('admin:wedstrijden') || []
    const idx = wedstrijden.findIndex(w => String(w.matchId) === String(matchId))
    if (idx === -1) return res.status(404).json({ error: 'Wedstrijd niet gevonden' })
    wedstrijden[idx] = {
      ...wedstrijden[idx],
      ...(competitie && { competitie }),
      ...(thuis && { thuis }),
      ...(thuisNaam && { thuisNaam }),
      ...(uit && { uit }),
      ...(uitNaam && { uitNaam }),
      ...(datum && { datum }),
      ...(datumISO && { datumISO }),
    }
    await slaHandmatigOp(wedstrijden)
    return res.status(200).json({ success: true, wedstrijd: wedstrijden[idx] })
  }

  if (req.method === 'POST' && action === 'verwijderen') {
    const { matchId } = body
    if (!matchId) return res.status(400).json({ error: 'matchId verplicht' })

    const wedstrijden = await kvGet('admin:wedstrijden') || []
    const nieuw = wedstrijden.filter(w => String(w.matchId) !== String(matchId))
    await slaHandmatigOp(nieuw)

    const vorigeResult = await kvGet(`result:${matchId}`)
    if (vorigeResult) {
      const totals = await kvGet('totals') || {}
      const nieuweTotals = { ...totals }
      for (const [playerId, punten] of Object.entries(vorigeResult.punten || {})) {
        nieuweTotals[playerId] = (nieuweTotals[playerId] || 0) - punten
      }
      await kvSet('totals', nieuweTotals)
      await kvSet(`result:${matchId}`, null)

      const index = await kvGet('results:index') || []
      const nieuweIndex = index.filter(id => String(id) !== String(matchId))
      await kvSet('results:index', nieuweIndex)
    }

    const predictionIndex = await kvGet(`predictionIndex:${matchId}`) || []
    for (const playerId of predictionIndex) {
      await kvSet(`prediction:${matchId}:${playerId}`, null)
    }
    await kvSet(`predictionIndex:${matchId}`, null)

    return res.status(200).json({ success: true })
  }

  if (req.method === 'POST' && action === 'verwijderVoorspelling') {
    const { matchId, playerId } = body
    if (!matchId) return res.status(400).json({ error: 'matchId verplicht' })

    const predictionIndex = await kvGet(`predictionIndex:${matchId}`) || []
    const teVerwijderen = playerId ? [playerId] : predictionIndex

    for (const id of teVerwijderen) {
      await kvSet(`prediction:${matchId}:${id}`, null)
    }
    const nieuweIndex = predictionIndex.filter(id => !teVerwijderen.includes(id))
    await kvSet(`predictionIndex:${matchId}`, nieuweIndex)

    const vorigeResult = await kvGet(`result:${matchId}`)
    if (vorigeResult) {
      const totals = await kvGet('totals') || {}
      const nieuweTotals = { ...totals }

      for (const id of teVerwijderen) {
        const oud = vorigeResult.punten?.[id] || 0
        nieuweTotals[id] = (nieuweTotals[id] || 0) - oud
      }

      const nieuwePunten = { ...vorigeResult.punten }
      const nieuweToto = { ...vorigeResult.toto }
      const nieuwePredicties = { ...vorigeResult.predicties }
      for (const id of teVerwijderen) {
        delete nieuwePunten[id]
        delete nieuweToto[id]
        delete nieuwePredicties[id]
      }

      const nieuwTotalenVeld = {}
      for (const id of Object.keys(nieuwePunten)) {
        nieuwTotalenVeld[id] = nieuweTotals[id]
      }

      const nieuwResult = {
        ...vorigeResult,
        predicties: nieuwePredicties,
        toto: nieuweToto,
        punten: nieuwePunten,
        totalen: nieuwTotalenVeld,
        verwerktOp: new Date().toISOString(),
      }
      await kvSet(`result:${matchId}`, nieuwResult)
      await kvSet('totals', nieuweTotals)
    }

    return res.status(200).json({ success: true })
  }

  if (req.method === 'POST' && action === 'uitslag') {
    const { matchId, homeScore, awayScore, matchInfo } = body
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
    const nieuwePunten = {}
    const nieuweToto = {}

    for (const playerId of spelersMetVoorspelling) {
      const pred = await kvGet(`prediction:${matchId}:${playerId}`)
      if (!pred) continue
      predicties[playerId] = { home: pred.home, away: pred.away }
      nieuwePunten[playerId] = berekenPunten(pred, uitslag)
      nieuweToto[playerId] = totoLabel(pred)
    }

    const vorigeResult = await kvGet(`result:${matchId}`)
    const totals = await kvGet('totals') || {}
    const nieuweTotals = { ...totals }

    if (vorigeResult) {
      for (const [playerId, oud] of Object.entries(vorigeResult.punten || {})) {
        nieuweTotals[playerId] = (nieuweTotals[playerId] || 0) - oud
      }
    }
    for (const [playerId, nieuw] of Object.entries(nieuwePunten)) {
      nieuweTotals[playerId] = (nieuweTotals[playerId] || 0) + nieuw
    }

    const totalen = {}
    for (const playerId of Object.keys(nieuwePunten)) {
      totalen[playerId] = nieuweTotals[playerId]
    }

    const result = {
      matchId, uitslag, volgnummer,
      predicties, toto: nieuweToto, punten: nieuwePunten, totalen,
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
    const idx = wedstrijden.findIndex(w => String(w.matchId) === String(matchId))
    if (idx !== -1) {
      wedstrijden[idx].uitslag = uitslag
      wedstrijden[idx].status = 'FT'
      await slaHandmatigOp(wedstrijden)
    }

    return res.status(200).json({ success: true, result, totals: nieuweTotals, punten: nieuwePunten })
  }

  return res.status(400).json({ error: 'Onbekende actie' })
}
