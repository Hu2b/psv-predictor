import { kvGet, kvSet } from './_kv.js'
import { zetCors } from './_cors.js'
import { fetchMetTimeout } from './_fetch.js'
import { haalAlleWedstrijden } from './_wedstrijden.js'
import { espnCompetitie, espnDatumVarianten, zoekEspnWedstrijd, maakOpstelling, opstellingIsDefinitief, espnStatus, wedstrijdStatus, psvEerst } from '../shared/espn.js'

// Opstellingen komen van ESPN, niet van football-data.org — dat levert ze op
// ons abonnement niet. ESPN publiceert ze ongeveer een uur voor de aftrap.
//
// De twee bronnen delen geen wedstrijd-id's, dus we zoeken de wedstrijd bij
// ESPN op via de datum en de twee teams (zie shared/espn.js). Het gevonden
// ESPN-id wordt bewaard, zodat die zoekslag maar één keer per wedstrijd nodig
// is.
const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/soccer'

// Twee aparte cachetijden. Het gevonden ESPN-id verandert nooit meer, dus dat
// houden we lang vast. De opstelling zelf verandert nog tot vlak voor de
// aftrap en tijdens de wedstrijd (wissels), dus die verloopt snel.
const ID_TTL_MS = 30 * 24 * 60 * 60 * 1000

// Niets gevonden onthouden we ook, maar korter: bij een gespeelde wedstrijd die
// ESPN niet heeft, scheelt dat een zoekslag per keer dat iemand hem openklapt.
const ID_MISLUKT_TTL_MS = 6 * 60 * 60 * 1000

// Tijdens de wedstrijd vallen er wissels, dus dan moet de cache kort zijn —
// anders zie je een wissel pas minuten later. Na het eindsignaal verandert er
// niets meer: dan houden we hem lang vast, zodat terugkijken naar een oude
// wedstrijd geen enkele aanroep meer kost.
const TTL_BEZIG_MS = 45 * 1000
const TTL_RUST_MS = 5 * 60 * 1000
const TTL_KLAAR_MS = 30 * 24 * 60 * 60 * 1000

function cacheTtl(status) {
  if (status === 'bezig') return TTL_BEZIG_MS
  if (status === 'afgelopen') return TTL_KLAAR_MS
  return TTL_RUST_MS
}

async function haalJson(url) {
  const res = await fetchMetTimeout(url)
  if (!res.ok) throw new Error(`ESPN gaf status ${res.status}`)
  return await res.json()
}

// Zoekt (en onthoudt) welk ESPN-id bij onze wedstrijd hoort.
async function zoekEspnId(fixture) {
  const sleutel = `espn:id:${fixture.matchId}`
  const bewaard = await kvGet(sleutel)
  if (bewaard?.op) {
    const ouderdom = Date.now() - new Date(bewaard.op).getTime()
    if (ouderdom < (bewaard.espnId ? ID_TTL_MS : ID_MISLUKT_TTL_MS)) return bewaard.espnId || null
  }

  const competitie = espnCompetitie(fixture.competitie)
  const datums = espnDatumVarianten(fixture.datumISO)
  if (!competitie || datums.length === 0) return null

  // Eerst de dag van de aftrap; pas als die niets oplevert de dag ervoor en
  // erna. Zo kost de normale situatie één aanroep.
  let espnId = null
  for (const datum of datums) {
    const data = await haalJson(`${ESPN}/${competitie}/scoreboard?dates=${datum}`)
    espnId = zoekEspnWedstrijd(data.events, fixture.thuis, fixture.uit)
    if (espnId) break
  }

  await kvSet(sleutel, { espnId: espnId || null, op: new Date().toISOString() })
  return espnId
}

export default async function handler(req, res) {
  zetCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { matchId } = req.query
  if (!matchId) return res.status(400).json({ error: 'matchId verplicht' })

  const cacheSleutel = `espn:opstelling:${matchId}`
  try {
    const cached = await kvGet(cacheSleutel)
    if (cached && Date.now() - new Date(cached.op).getTime() < cacheTtl(cached.status)) {
      return res.status(200).json({
        opstellingen: psvEerst(cached.opstellingen),
        definitief: Boolean(cached.definitief),
        status: cached.status || 'voor',
        bron: 'espn',
      })
    }

    const wedstrijden = await haalAlleWedstrijden()
    const fixture = wedstrijden.find(w => String(w.matchId) === String(matchId))
    if (!fixture) return res.status(404).json({ error: 'Wedstrijd niet gevonden' })

    const eigenStatus = wedstrijdStatus(fixture)

    const espnId = await zoekEspnId(fixture)
    if (!espnId) {
      return res.status(200).json({
        opstellingen: [],
        status: eigenStatus,
        reden: 'wedstrijd niet gevonden bij ESPN',
      })
    }

    const competitie = espnCompetitie(fixture.competitie)
    const samenvatting = await haalJson(`${ESPN}/${competitie}/summary?event=${espnId}`)
    const opstellingen = maakOpstelling(samenvatting.rosters)
    const definitief = opstellingIsDefinitief(samenvatting)
    // ESPN weet het beter dan wij, behalve als het daar helemaal ontbreekt.
    const status = espnStatus(samenvatting) === 'voor' ? eigenStatus : espnStatus(samenvatting)

    // Een lege opstelling is vóór de wedstrijd geen fout: tot ongeveer een uur
    // voor de aftrap bestaat hij simpelweg nog niet, en dan bewaren we niets
    // zodat de volgende aanroep opnieuw kijkt. Bij een gespeelde wedstrijd is
    // leeg wél het eindantwoord — die komt er niet meer bij.
    const bruikbaar = opstellingen.filter(o => o.basis.length > 0)
    if (bruikbaar.length > 0 || status === 'afgelopen') {
      await kvSet(cacheSleutel, { opstellingen: bruikbaar, definitief, status, op: new Date().toISOString() })
    }

    return res.status(200).json({ opstellingen: psvEerst(bruikbaar), definitief, status, bron: 'espn' })
  } catch (e) {
    console.error('Opstelling ophalen mislukt:', e)
    // Geen 500: een ontbrekende opstelling mag het wedstrijdscherm nooit
    // stukmaken. De app toont dan gewoon geen link.
    return res.status(200).json({ opstellingen: [], reden: 'ophalen mislukt' })
  }
}
