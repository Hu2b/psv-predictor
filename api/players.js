import { alleSpelers } from './_players.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const spelers = await alleSpelers()
  const publiek = spelers
    .filter(s => s.geverifieerd)
    .map(s => ({ id: s.id, naam: s.naam }))
    .sort((a, b) => a.naam.localeCompare(b.naam))

  return res.status(200).json({ spelers: publiek })
}
