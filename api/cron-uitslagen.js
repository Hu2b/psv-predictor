import { haalAlleWedstrijden, checkEnSlaUitslagenOp } from './_wedstrijden.js'

// Vercel Cron tikt dit endpoint aan. Zonder cron werd een uitslag pas
// verwerkt als toevallig iemand de app opende ná de wachttijd van 135
// minuten — deed niemand dat, dan bleef de wedstrijd voorgoed uit het
// klassement.
//
// Vercel stuurt automatisch `Authorization: Bearer $CRON_SECRET` mee zodra
// die environment variable is ingesteld. Staat hij niet ingesteld, dan is
// het endpoint open (handig om lokaal te testen, maar zet 'm in productie).
export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const fixtures = await haalAlleWedstrijden()
    const verwerkt = await checkEnSlaUitslagenOp(fixtures)
    return res.status(200).json({
      ok: true,
      gecontroleerd: fixtures.length,
      nieuwVerwerkt: verwerkt,
    })
  } catch (err) {
    console.error('Cron uitslagen mislukt:', err)
    return res.status(500).json({ error: err.message })
  }
}
