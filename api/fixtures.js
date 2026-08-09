import { haalAlleWedstrijden, checkEnSlaUitslagenOp, SEASON } from './_wedstrijden.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  try {
    const fixtures = await haalAlleWedstrijden()

    // Bewust AWAIT en geen fire-and-forget: op Vercel mag de serverless
    // functie bevroren of afgebroken worden zodra het antwoord verstuurd is,
    // waardoor de KV-writes van een net verwerkte uitslag verloren gingen.
    // checkEnSlaUitslagenOp() doet één KV-read en stopt direct als er geen
    // nieuwe, nog niet verwerkte uitslag is — de normale kosten zijn dus
    // verwaarloosbaar. Een fout hierin mag het ophalen van de wedstrijden
    // nooit laten falen.
    try {
      await checkEnSlaUitslagenOp(fixtures)
    } catch (e) {
      console.error('uitslag fout:', e)
    }

    return res.status(200).json({ fixtures, season: SEASON })
  } catch (err) {
    console.error('Fixtures handler error:', err)
    return res.status(500).json({ error: err.message })
  }
}
