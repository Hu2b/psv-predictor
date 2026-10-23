// Welke wedstrijden zijn nu aan de beurt voor een herinnering?
//
// Dit staat los van het endpoint (`cron-herinnering.js`) om twee redenen: het
// is te testen zonder de hele handler, en alles in `api/` dat NIET met een
// liggend streepje begint wordt door Vercel een aparte serverless functie. Op
// het gratis abonnement mogen dat er maar twaalf, dus hulpbestanden en tests
// horen hier met een streepje te beginnen.

// Het venster rond "een half uur van tevoren". Ruim genoeg dat een tikker die
// elke tien minuten langskomt er altijd minstens één keer in valt, en smal
// genoeg dat niemand drie kwartier van tevoren al een bericht krijgt.
const VENSTER_VROEG_MIN = 40
const VENSTER_LAAT_MIN = 20

export function valtInVenster(datumISO, nu = Date.now()) {
  const aftrap = new Date(datumISO).getTime()
  if (Number.isNaN(aftrap)) return false
  const minuten = (aftrap - nu) / 60000
  return minuten <= VENSTER_VROEG_MIN && minuten >= VENSTER_LAAT_MIN
}

// Een wedstrijd die al begonnen of gespeeld is krijgt niets meer.
const GESPEELD = ['FT', 'AET', 'PEN', '1H', 'HT', '2H', 'ET', 'BT', 'LIVE']

export function wachtendeWedstrijden(fixtures, nu = Date.now()) {
  return (fixtures || []).filter(f => !GESPEELD.includes(f.status) && valtInVenster(f.datumISO, nu))
}
