import { kvGet, kvSet } from './_kv.js'
import { getPlayerById, telGeverifieerdeSpelers } from './_players.js'
import { verifieerSessie } from './_auth.js'
import { zetCors } from './_cors.js'

export default async function handler(req, res) {
  zetCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method === 'GET') {
    const { matchId, datumISO } = req.query

    // Identiteit komt UITSLUITEND uit de geverifieerde sessie, nooit uit een
    // door de client meegestuurde playerId. Anders zou iemand met andermans
    // playerId diens (nog geheime) voorspelling kunnen opvragen.
    const check = await verifieerSessie(req.query.sessionToken)
    if (check.fout) return res.status(401).json({ error: check.fout })
    const playerId = check.speler.id

    if (!matchId) return res.status(400).json({ error: 'matchId verplicht' })

    const index = await kvGet(`predictionIndex:${matchId}`) || []
    const alle = await Promise.all(index.map(id => kvGet(`prediction:${matchId}:${id}`)))
    const geldig = alle.filter(Boolean)

    const mijnPrediction = geldig.find(p => p.playerId === playerId) || null

    const nu = Date.now()
    const kickoff = datumISO ? new Date(datumISO).getTime() : null
    const kickoffVoorbij = kickoff ? nu >= kickoff : false

    const totaalSpelers = await telGeverifieerdeSpelers()
    const iedereenVoorspeld = totaalSpelers > 0 && geldig.length >= totaalSpelers
    const bestaandResultaat = await kvGet(`result:${matchId}`)

    // Onthullen zodra de wedstrijd begonnen is, óf zodra alle spelers hebben
    // voorspeld, óf zodra de uitslag al is vastgelegd (dekt het uitzonderings-
    // geval af waarin een beheerder een uitslag invoert vóór de geplande
    // aftraptijd, bijvoorbeeld bij een handmatig toegevoegde wedstrijd).
    const onthuld = kickoffVoorbij || iedereenVoorspeld || !!bestaandResultaat

    let anderePredicties = []
    if (onthuld) {
      const andereRows = geldig.filter(p => p.playerId !== playerId)
      anderePredicties = await Promise.all(andereRows.map(async p => {
        const speler = await getPlayerById(p.playerId)
        return { playerId: p.playerId, naam: speler?.naam || '???', home: p.home, away: p.away }
      }))
    }

    return res.status(200).json({
      mijnPrediction, anderePredicties, onthuld,
      aantalVoorspeld: geldig.length, totaalSpelers,
    })
  }

  if (req.method === 'POST') {
    let body = req.body
    if (typeof body === 'string') { try { body = JSON.parse(body) } catch (_) {} }
    const { matchId, home, away, datumISO, action } = body || {}

    // Ook hier: de speler wordt bepaald door zijn sessie, niet door een
    // meegestuurde playerId. Zo kan niemand de voorspelling van een andere
    // speler overschrijven of verwijderen.
    const check = await verifieerSessie(body?.sessionToken)
    if (check.fout) return res.status(401).json({ error: check.fout })
    const playerId = check.speler.id

    if (action === 'verwijderen') {
      if (!matchId) return res.status(400).json({ error: 'matchId verplicht' })
      await kvSet(`prediction:${matchId}:${playerId}`, null)
      const index = await kvGet(`predictionIndex:${matchId}`) || []
      const nieuweIndex = index.filter(id => id !== playerId)
      await kvSet(`predictionIndex:${matchId}`, nieuweIndex)
      return res.status(200).json({ success: true })
    }

    if (!matchId) return res.status(400).json({ error: 'matchId verplicht' })
    if (home === undefined || away === undefined) return res.status(400).json({ error: 'home en away verplicht' })

    if (datumISO && new Date() > new Date(datumISO)) {
      return res.status(403).json({ error: 'Wedstrijd al begonnen, wijzigen niet meer mogelijk' })
    }

    const bestaandResultaat = await kvGet(`result:${matchId}`)
    if (bestaandResultaat) {
      return res.status(403).json({ error: 'Uitslag is al vastgelegd, wijzigen niet meer mogelijk' })
    }

    const bestaandeIndex = await kvGet(`predictionIndex:${matchId}`) || []
    const totaalSpelers = await telGeverifieerdeSpelers()
    if (totaalSpelers > 0 && bestaandeIndex.length >= totaalSpelers) {
      // Iedereen had al voorspeld (dus voorspellingen zijn al onthuld) —
      // ook wie zelf al had voorspeld, kan dan niet meer wijzigen.
      return res.status(403).json({ error: 'Voorspellingen zijn al onthuld, wijzigen niet meer mogelijk' })
    }

    const prediction = {
      matchId, playerId,
      home: parseInt(home), away: parseInt(away),
      confirmed: true, timestamp: new Date().toISOString(),
    }
    await kvSet(`prediction:${matchId}:${playerId}`, prediction)

    const index = await kvGet(`predictionIndex:${matchId}`) || []
    if (!index.includes(playerId)) {
      index.push(playerId)
      await kvSet(`predictionIndex:${matchId}`, index)
    }

    return res.status(200).json({ success: true, prediction })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
