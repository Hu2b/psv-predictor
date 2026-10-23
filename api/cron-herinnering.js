import { haalAlleWedstrijden } from './_wedstrijden.js'
import { stuurHerinneringen } from './_notificaties.js'
import { wachtendeWedstrijden } from './_herinnering.js'

// Stuurt kort voor de aftrap een herinnering aan iedereen die nog niet heeft
// voorspeld. Wordt aangetikt door een externe tikker (zie README): Vercel's
// eigen cron mag op het gratis abonnement maar één keer per dag draaien, en
// daar red je "een half uur van tevoren" niet mee.
//
// Het endpoint is opzettelijk dom en herhaalbaar: het kijkt wélke wedstrijden
// nu in het venster vallen en laat stuurHerinneringen() bepalen of er al iets
// uit is gegaan. Twee keer aantikken levert dus geen twee berichten op.
export default async function handler(req, res) {
  // Dezelfde sleutel als de dagelijkse cron. Vercel stuurt hem als
  // Authorization-header mee; een externe tikker die geen headers kan zetten
  // mag hem ook als ?secret= meegeven. Een header heeft de voorkeur: een
  // zoekparameter komt in logbestanden terecht.
  const secret = process.env.CRON_SECRET
  if (secret) {
    const viaHeader = req.headers.authorization === `Bearer ${secret}`
    const viaQuery = req.query?.secret === secret
    if (!viaHeader && !viaQuery) return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const fixtures = await haalAlleWedstrijden()
    const binnenkort = wachtendeWedstrijden(fixtures)

    const uitkomsten = []
    for (const fixture of binnenkort) {
      const uitkomst = await stuurHerinneringen(fixture)
      uitkomsten.push({ matchId: fixture.matchId, ...uitkomst })
    }

    return res.status(200).json({
      ok: true,
      gecontroleerd: fixtures.length,
      inVenster: binnenkort.length,
      uitkomsten,
    })
  } catch (err) {
    console.error('Cron herinnering mislukt:', err)
    return res.status(500).json({ error: err.message })
  }
}
