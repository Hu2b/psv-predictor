import { kvGet, kvSet } from './_kv.js'
import { haalAlleWedstrijden } from './_wedstrijden.js'

export default async function handler(req, res) {
  const index = await kvGet('results:index') || []
  const alleWedstrijden = await haalAlleWedstrijden()
  const geldigeIds = new Set(alleWedstrijden.map(f => String(f.matchId)))

  const verwijderd = []
  let totals = await kvGet('totals') || { niek: 0, huub: 0 }

  for (const matchId of index) {
    if (geldigeIds.has(String(matchId))) continue // wedstrijd bestaat nog, niets doen

    const result = await kvGet(`result:${matchId}`)
    if (result) {
      totals = {
        niek: totals.niek - (result.puntNiek || 0),
        huub: totals.huub - (result.puntHuub || 0),
      }
      await kvSet(`result:${matchId}`, null)
      await kvSet(`prediction:${matchId}:niek`, null)
      await kvSet(`prediction:${matchId}:huub`, null)
      verwijderd.push({ matchId, afgetrokken: { niek: result.puntNiek || 0, huub: result.puntHuub || 0 } })
    }
  }

  const nieuweIndex = index.filter(id => geldigeIds.has(String(id)))
  await kvSet('results:index', nieuweIndex)
  await kvSet('totals', totals)

  return res.status(200).json({
    success: true,
    message: `${verwijderd.length} weeskind-resultaat(en) verwijderd en totalen gecorrigeerd.`,
    verwijderd,
    nieuweTotals: totals
  })
}
