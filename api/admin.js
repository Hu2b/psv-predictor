import { kvGet, kvSet } from './_kv.js'
import { berekenPunten, totoLabel } from './_scoring.js'

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
    const [niek, huub] = await Promise.all([
      kvGet(`prediction:${matchId}:niek`),
      kvGet(`prediction:${matchId}:huub`),
    ])
    return res.status(200).json({ niek, huub, beideBevest: !!(niek?.confirmed && huub?.confirmed) })
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
    return res.status(200).json({ success: true })
  }

  if (req.method === 'POST' && action === 'verwijderVoorspelling') {
    const { matchId, speler } = body
    if (!matchId) return res.status(400).json({ error: 'matchId verplicht' })

    // Verwijder voorspelling(en)
    const teVerwijderen = speler ? [speler.toLowerCase()] : ['niek', 'huub']
    for (const s of teVerwijderen) {
      await kvSet(`prediction:${matchId}:${s}`, null)
    }

    // Herbereken punten als er al een result was
    const vorigeResult = await kvGet(`result:${matchId}`)
    if (vorigeResult) {
      const [predNiek, predHuub] = await Promise.all([
        kvGet(`prediction:${matchId}:niek`),
        kvGet(`prediction:${matchId}:huub`),
      ])
      const uitslag = vorigeResult.uitslag
      const puntNiek = berekenPunten(predNiek, uitslag)
      const puntHuub = berekenPunten(predHuub, uitslag)
      const totals = await kvGet('totals') || { niek: 0, huub: 0 }
      const nieuweTotals = {
        niek: totals.niek - (vorigeResult.puntNiek || 0) + puntNiek,
        huub: totals.huub - (vorigeResult.puntHuub || 0) + puntHuub,
      }
      const nieuwResult = {
        ...vorigeResult,
        predNiek: predNiek ? { home: predNiek.home, away: predNiek.away } : null,
        predHuub: predHuub ? { home: predHuub.home, away: predHuub.away } : null,
        totoNiek: totoLabel(predNiek),
        totoHuub: totoLabel(predHuub),
        puntNiek, puntHuub,
        totaalNiek: nieuweTotals.niek,
        totaalHuub: nieuweTotals.huub,
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
    const [predNiek, predHuub] = await Promise.all([
      kvGet(`prediction:${matchId}:niek`),
      kvGet(`prediction:${matchId}:huub`),
    ])
    const puntNiek = berekenPunten(predNiek, uitslag)
    const puntHuub = berekenPunten(predHuub, uitslag)
    const vorigeResult = await kvGet(`result:${matchId}`)
    const totals = await kvGet('totals') || { niek: 0, huub: 0 }
    const nieuweTotals = {
      niek: totals.niek - (vorigeResult?.puntNiek || 0) + puntNiek,
      huub: totals.huub - (vorigeResult?.puntHuub || 0) + puntHuub,
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
    const idx = wedstrijden.findIndex(w => String(w.matchId) === String(matchId))
    if (idx !== -1) {
      wedstrijden[idx].uitslag = uitslag
      wedstrijden[idx].status = 'FT'
      await slaHandmatigOp(wedstrijden)
    }
    return res.status(200).json({ success: true, result, totals: nieuweTotals, punten: { niek: puntNiek, huub: puntHuub } })
  }

  return res.status(400).json({ error: 'Onbekende actie' })
}
