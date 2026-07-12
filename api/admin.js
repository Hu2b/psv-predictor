import { kvGet, kvSet } from './_kv.js'
import { zoekVolgnummer, berekenEnSlaResultaatOp, herberekenAlleTotalen } from './_wedstrijden.js'
import { getPlayerById } from './_players.js'
import { verifieerBeheerderSessie } from './_auth.js'

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

  // Alle acties op dit endpoint (lezen én schrijven) vereisen een geldige
  // sessie van een beheerder — voorkomt dat iemand die de URL raadt
  // wedstrijden/uitslagen kan wijzigen zonder ingelogd te zijn.
  const sessionToken = req.method === 'GET' ? req.query.sessionToken : body?.sessionToken
  const check = await verifieerBeheerderSessie(sessionToken)
  if (check.fout) return res.status(403).json({ error: check.fout })

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
      await kvSet(`result:${matchId}`, null)

      const index = await kvGet('results:index') || []
      const nieuweIndex = index.filter(id => String(id) !== String(matchId))
      await kvSet('results:index', nieuweIndex)

      // Volledige herberekening in plaats van alleen het globale totaal
      // bij te werken — zo blijven ook de per-wedstrijd "totaal"-momentopnames
      // van de OVERIGE wedstrijden kloppend na deze verwijdering.
      await herberekenAlleTotalen()
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

    // Was de wedstrijd al verwerkt? Dan alles herberekenen via dezelfde
    // centrale functie als de automatische verwerking gebruikt.
    const vorigeResult = await kvGet(`result:${matchId}`)
    if (vorigeResult) {
      await berekenEnSlaResultaatOp({
        matchId: vorigeResult.matchId,
        volgnummer: vorigeResult.volgnummer,
        datumISO: vorigeResult.datumISO,
        datum: vorigeResult.datum,
        competitie: vorigeResult.competitie,
        thuis: vorigeResult.thuis,
        uit: vorigeResult.uit,
      }, vorigeResult.uitslag)
    }

    return res.status(200).json({ success: true })
  }

  if (req.method === 'POST' && action === 'uitslag') {
    const { matchId, homeScore, awayScore, matchInfo } = body
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

    const wedstrijden = await kvGet('admin:wedstrijden') || []
    const idx = wedstrijden.findIndex(w => String(w.matchId) === String(matchId))
    if (idx !== -1) {
      wedstrijden[idx].uitslag = uitslag
      wedstrijden[idx].status = 'FT'
      await slaHandmatigOp(wedstrijden)
    }

    return res.status(200).json({ success: true, result, totals: result.totalen, punten: result.punten })
  }

  // Herberekent een AL verwerkte wedstrijd opnieuw, met de HUIDIGE
  // spelerslijst en voorspellingen — handig als een speler zich pas ná het
  // verwerken van de uitslag heeft aangemeld/geverifieerd, of als een
  // voorspelling nog is bijgewerkt. Gebruikt dezelfde uitslag die al was
  // vastgelegd, dus de score hoeft niet opnieuw te worden ingetypt.
  if (req.method === 'POST' && action === 'herberekenen') {
    const { matchId } = body
    if (!matchId) return res.status(400).json({ error: 'matchId verplicht' })

    const bestaandResultaat = await kvGet(`result:${matchId}`)
    if (!bestaandResultaat) return res.status(404).json({ error: 'Deze wedstrijd heeft nog geen uitslag' })

    const result = await berekenEnSlaResultaatOp({
      matchId: bestaandResultaat.matchId,
      volgnummer: bestaandResultaat.volgnummer,
      datumISO: bestaandResultaat.datumISO,
      datum: bestaandResultaat.datum,
      competitie: bestaandResultaat.competitie,
      thuis: bestaandResultaat.thuis,
      uit: bestaandResultaat.uit,
    }, bestaandResultaat.uitslag)

    return res.status(200).json({ success: true, result, totals: result.totalen, punten: result.punten })
  }

  // Verwijdert een al vastgelegde uitslag weer volledig — kan ook nog nadat
  // de wedstrijd al begonnen/afgelopen is, zodat een beheerder een fout
  // altijd kan corrigeren. De voorspellingen van spelers blijven gewoon
  // staan; alleen de uitslag en de daaraan toegekende punten verdwijnen.
  if (req.method === 'POST' && action === 'verwijderUitslag') {
    const { matchId } = body
    if (!matchId) return res.status(400).json({ error: 'matchId verplicht' })

    const bestaandResultaat = await kvGet(`result:${matchId}`)
    if (!bestaandResultaat) return res.status(404).json({ error: 'Deze wedstrijd heeft nog geen uitslag' })

    await kvSet(`result:${matchId}`, null)
    const index = await kvGet('results:index') || []
    const nieuweIndex = index.filter(id => String(id) !== String(matchId))
    await kvSet('results:index', nieuweIndex)
    await herberekenAlleTotalen()

    // Bij een handmatig toegevoegde wedstrijd ook de uitslag/status in de
    // lijst zelf resetten (de wedstrijd zelf blijft gewoon bestaan).
    const wedstrijden = await kvGet('admin:wedstrijden') || []
    const idx = wedstrijden.findIndex(w => String(w.matchId) === String(matchId))
    if (idx !== -1) {
      wedstrijden[idx].uitslag = null
      wedstrijden[idx].status = 'NS'
      await slaHandmatigOp(wedstrijden)
    }

    return res.status(200).json({ success: true })
  }

  return res.status(400).json({ error: 'Onbekende actie' })
}
