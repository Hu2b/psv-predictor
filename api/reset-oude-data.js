import { kvGet, kvSet } from './_kv.js'

// Eenmalig opruimscript: verwijdert de oude 'totals' en 'results'-data uit
// het vorige (niek/huub) systeem, zodat het klassement voortaan alleen nog
// echte, geregistreerde spelers toont. Na gebruik mag dit bestand weer weg.
export default async function handler(req, res) {
  const oudeIndex = await kvGet('results:index') || []

  for (const matchId of oudeIndex) {
    await kvSet(`result:${matchId}`, null)
  }

  await kvSet('results:index', null)
  await kvSet('totals', null)

  return res.status(200).json({
    success: true,
    message: `Oude data gewist: ${oudeIndex.length} resultaten + totalen. Het klassement begint nu leeg voor alle nieuwe spelers.`
  })
}
