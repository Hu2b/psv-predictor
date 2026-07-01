import { haalAlleWedstrijden, checkEnSlaUitslagenOp, SEASON } from './_wedstrijden.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  try {
    const fixtures = await haalAlleWedstrijden()

    // Verwerk uitslagen op achtergrond (135 min na afloop)
    checkEnSlaUitslagenOp(fixtures).catch(e => console.error('uitslag fout:', e))

    return res.status(200).json({ fixtures, season: SEASON })
  } catch (err) {
    console.error('Fixtures handler error:', err)
    return res.status(500).json({ error: err.message })
  }
}
