import { kvGet, kvSet } from './_kv.js'
import { getPlayerById } from './_players.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method === 'GET') {
    const { matchId, playerId, datumISO } = req.query
    if (!matchId) return res.status(400).json({ error: 'matchId verplicht' })

    const index = await kvGet(`predictionIndex:${matchId}`) || []
    const alle = await Promise.all(index.map(id => kvGet(`prediction:${matchId}:${id}`)))
    const geldig = alle.filter(Boolean)

    const mijnPrediction = playerId ? geldig.find(p => p.playerId === playerId) || null : null

    const nu = Date.now()
    const kickoff = datumISO ? new Date(datumISO).getTime() : null
    const onthuld = kickoff ? nu >= kickoff : true

    let anderePredicties = []
    if (onthuld) {
      const andereRows = geldig.filter(p => p.playerId !== playerId)
      anderePredicties = await Promise.all(andereRows.map(async p => {
        const speler = await getPlayerById(p.playerId)
        return { playerId: p.playerId, naam: speler?.naam || '???', home: p.home, away: p.away }
      }))
    }

    return res.status(200).json({ mijnPrediction, anderePredicties, onthuld, aantalVoorspeld: geldig.length })
  }

  if (req.method === 'POST') {
    let body = req.body
    if (typeof body === 'string') { try { body = JSON.parse(body) } catch (_) {} }
    const { matchId, playerId, home, away, datumISO, action } = body || {}

    if (action === 'verwijderen') {
      if (!matchId || !playerId) return res.status(400).json({ error: 'matchId en playerId verplicht' })
      await kvSet(`prediction:${matchId}:${playerId}`, null)
      const index = await kvGet(`predictionIndex:${matchId}`) || []
      const nieuweIndex = index.filter(id => id !== playerId)
      await kvSet(`predictionIndex:${matchId}`, nieuweIndex)
      return res.status(200).json({ success: true })
    }

    if (!matchId || !playerId) return res.status(400).json({ error: 'matchId en playerId verplicht' })
    if (home === undefined || away === undefined) return res.status(400).json({ error: 'home en away verplicht' })

    if (datumISO && new Date() > new Date(datumISO)) {
      return res.status(403).json({ error: 'Wedstrijd al begonnen, wijzigen niet meer mogelijk' })
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
