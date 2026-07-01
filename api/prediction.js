import { kvGet, kvSet } from './_kv.js'

const SPELERS = ['niek', 'huub']

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method === 'GET') {
    const { matchId, speler } = req.query
    if (!matchId) return res.status(400).json({ error: 'matchId verplicht' })
    if (speler) {
      const pred = await kvGet(`prediction:${matchId}:${speler.toLowerCase()}`)
      return res.status(200).json({ prediction: pred })
    }
    const [niek, huub] = await Promise.all([
      kvGet(`prediction:${matchId}:niek`),
      kvGet(`prediction:${matchId}:huub`),
    ])
    return res.status(200).json({
      niek, huub,
      beideBevest: !!(niek?.confirmed && huub?.confirmed),
    })
  }

  if (req.method === 'POST') {
    let body = req.body
    if (typeof body === 'string') { try { body = JSON.parse(body) } catch (_) {} }
    const { matchId, speler, home, away, datumISO, action } = body || {}

    // Verwijder voorspelling(en)
    if (action === 'verwijderen') {
      if (!matchId) return res.status(400).json({ error: 'matchId verplicht' })
      const teVerwijderen = speler ? [speler.toLowerCase()] : ['niek', 'huub']
      for (const s of teVerwijderen) {
        await kvSet(`prediction:${matchId}:${s}`, null)
      }
      return res.status(200).json({ success: true })
    }

    if (!matchId || !speler) return res.status(400).json({ error: 'matchId en speler verplicht' })
    if (!SPELERS.includes(speler.toLowerCase())) return res.status(400).json({ error: 'Ongeldige speler' })
    if (home === undefined || away === undefined) return res.status(400).json({ error: 'home en away verplicht' })

    // Check of beide al bevestigd hebben
    const andere = speler.toLowerCase() === 'niek' ? 'huub' : 'niek'
    const anderePred = await kvGet(`prediction:${matchId}:${andere}`)
    const mijnPred = await kvGet(`prediction:${matchId}:${speler.toLowerCase()}`)

    // Als beide al bevestigd: niet meer wijzigen
    if (mijnPred?.confirmed && anderePred?.confirmed) {
      return res.status(403).json({ error: 'Beide spelers hebben al voorspeld — wijzigen niet meer mogelijk' })
    }

    if (datumISO && new Date() > new Date(datumISO)) {
      return res.status(403).json({ error: 'Wedstrijd al begonnen' })
    }

    const prediction = {
      matchId, speler: speler.toLowerCase(),
      home: parseInt(home), away: parseInt(away),
      confirmed: true, timestamp: new Date().toISOString(),
    }
    await kvSet(`prediction:${matchId}:${speler.toLowerCase()}`, prediction)
    
    // Check of nu beide bevestigd zijn
    const check = await kvGet(`prediction:${matchId}:${andere}`)
    return res.status(200).json({ 
      success: true, prediction,
      beideBevest: !!(prediction.confirmed && check?.confirmed)
    })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
