import { kvGet, kvSet } from './_kv.js'
import { zoekVolgnummer } from './_wedstrijden.js'

export default async function handler(req, res) {
  const index = await kvGet('results:index') || []
  const bijgewerkt = []

  for (const matchId of index) {
    const result = await kvGet(`result:${matchId}`)
    if (!result) continue
    if (result.volgnummer) continue // heeft het al, niets doen

    const volgnummer = await zoekVolgnummer(matchId)
    if (volgnummer) {
      await kvSet(`result:${matchId}`, { ...result, volgnummer })
      bijgewerkt.push({ matchId, volgnummer })
    }
  }

  return res.status(200).json({
    success: true,
    message: `${bijgewerkt.length} resultaat(en) aangevuld met volgnummer.`,
    bijgewerkt
  })
}
