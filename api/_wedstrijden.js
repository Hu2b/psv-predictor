import { kvGet, kvSet } from './_kv.js'
import { berekenPunten, totoLabel } from './_scoring.js'
import { zoekAfkorting, zoekVerzorgdeNaam } from '../shared/teams.js'
import { bewaarLogoAlsNieuw, zoekLogo } from './_logo-lookup.js'
import { alleGeverifieerdeSpelers } from './_players.js'
import { stuurUitslagNotificaties } from './_notificaties.js'
import { fetchMetTimeout } from './_fetch.js'

const API_KEY = process.env.FOOTBALL_DATA_KEY
const API_BASE = 'https://api.football-data.org/v4'

function bepaalSeizoen() {
  const nu = new Date()
  const jaar = nu.getFullYear()
  const maand = nu.getMonth() + 1
  const dag = nu.getDate()
  if (maand > 6 || (maand === 6 && dag >= 15)) return jaar
  return jaar - 1
}

export const SEASON = parseInt(process.env.PSV_SEASON || String(bepaalSeizoen()))
const COMPETITIONS = { DED: 'ERE', CL: 'CL' }

// Elke 5 minuten verversen: 2 aanroepen naar football-data.org per ververs-
// beurt, ruim binnen hun limiet van 10 aanroepen per minuut (gratis laag).
const CACHE_TTL_MS = 5 * 60 * 1000

function dagAfkorting(dateStr) {
  const d = new Date(dateStr)
  const dagen = ['zo','ma','di','wo','do','vr','za']
  return dagen[d.getDay()]
}

function formatDatum(dateStr) {
  const d = new Date(dateStr)
  const maanden = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']
  return `${dagAfkorting(dateStr)} ${d.getDate()} ${maanden[d.getMonth()]} ${d.getFullYear()}`
}

export function mapStatus(s) {
  // AWARDED = een door de bond toegekende uitslag (bijv. na een gestaakte
  // wedstrijd). Die telt net zo goed als afgelopen; livescore.js hanteerde
  // die lijst al, de wedstrijdenlijst liet 'm voorheen als 'NS' vallen
  // waardoor zo'n wedstrijd nooit punten opleverde.
  if (s === 'FINISHED' || s === 'AWARDED') return 'FT'
  // Verlenging en strafschoppen zijn ook gewoon 'bezig'.
  if (s === 'IN_PLAY' || s === 'PAUSED' || s === 'EXTRA_TIME' || s === 'PENALTY_SHOOTOUT') return 'LIVE'
  return 'NS'
}

// Let op: een time-out gooit hier bewust een fout omhoog i.p.v. een lege lijst
// terug te geven. De aanroeper vangt dat af en houdt de VORIGE cache aan —
// terwijl een lege lijst als "geldig" resultaat weggeschreven zou worden en
// wedstrijden dus 5 minuten lang zou laten verdwijnen.
async function fetchCompetitionMatches(code) {
  const url = `${API_BASE}/competitions/${code}/matches?season=${SEASON}`
  const res = await fetchMetTimeout(url, { headers: { 'X-Auth-Token': API_KEY } })
  const data = await res.json()
  if (data.error || data.errorCode) return []
  return data.matches || []
}

export function mapMatch(m, comp) {
  const status = mapStatus(m.status)
  const home = m.score?.fullTime?.home
  const away = m.score?.fullTime?.away
  const heeftEindstand = Number.isInteger(home) && Number.isInteger(away)

  let uitslag = null
  if (status === 'FT') {
    // Alleen een uitslag vastleggen als de feed de eindstand ECHT heeft
    // ingevuld. Meldt football-data.org wel afgelopen maar staat de score nog
    // op null, dan blijft uitslag leeg en wacht de verwerking tot de cijfers
    // er zijn. Zonder deze controle zou er een null-null uitslag worden
    // vastgelegd: iedereen 0 punten, wedstrijd als verwerkt geregistreerd, en
    // dat herstelt zichzelf nooit meer.
    if (heeftEindstand) uitslag = { home, away, status: 'FT' }
  } else if (status === 'LIVE') {
    uitslag = { home: home ?? 0, away: away ?? 0, status: 'LIVE' }
  }
  return {
    matchId: m.id, competitie: comp,
    thuis: zoekAfkorting(m.homeTeam.name), thuisNaam: zoekVerzorgdeNaam(m.homeTeam.name),
    thuisLogo: m.homeTeam.crest, thuisId: m.homeTeam.id,
    uit: zoekAfkorting(m.awayTeam.name), uitNaam: zoekVerzorgdeNaam(m.awayTeam.name),
    uitLogo: m.awayTeam.crest, uitId: m.awayTeam.id,
    dag: dagAfkorting(m.utcDate), datum: formatDatum(m.utcDate),
    datumISO: m.utcDate, status, uitslag,
  }
}

// Haalt alleen de automatische (football-data.org) wedstrijden op, met cache
async function haalAutomatischeWedstrijden() {
  const cacheKey = `psv:fixtures:fd:${SEASON}`
  const cached = await kvGet(cacheKey)
  const nu = Date.now()

  if (cached?.fixtures && cached?.cached_at) {
    const leeftijdMs = nu - new Date(cached.cached_at).getTime()
    if (leeftijdMs < CACHE_TTL_MS) return cached.fixtures
  }

  if (!API_KEY) {
    return cached?.fixtures || []
  }

  try {
    const PSV_NAMES = ['PSV', 'PSV Eindhoven']
    let fixtures = []
    for (const [code, comp] of Object.entries(COMPETITIONS)) {
      const matches = await fetchCompetitionMatches(code)
      const psvMatches = matches.filter(m =>
        PSV_NAMES.includes(m.homeTeam.name) || PSV_NAMES.includes(m.awayTeam.name)
      )
      fixtures = fixtures.concat(psvMatches.map(m => mapMatch(m, comp)))
    }
    const payload = { fixtures, cached_at: new Date().toISOString() }
    await kvSet(cacheKey, payload)
    return fixtures
  } catch (err) {
    console.error('Automatische wedstrijden ophalen mislukt:', err)
    // Bij een fout: liever verouderde data tonen dan niets, ook als de cache
    // al ouder is dan de TTL.
    return cached?.fixtures || []
  }
}

export async function haalAlleWedstrijden() {
  const [automatisch, handmatig] = await Promise.all([
    haalAutomatischeWedstrijden(),
    kvGet('admin:wedstrijden'),
  ])

  await Promise.all(
    automatisch.flatMap(f => [
      bewaarLogoAlsNieuw(f.thuis, f.thuisLogo),
      bewaarLogoAlsNieuw(f.uit, f.uitLogo),
    ])
  )

  const handmatigMetLogos = await Promise.all(
    (handmatig || []).map(async f => ({
      ...f,
      thuisLogo: f.thuisLogo || await zoekLogo(f.thuis),
      uitLogo: f.uitLogo || await zoekLogo(f.uit),
    }))
  )

  const seen = new Set()
  let alle = [...automatisch, ...handmatigMetLogos].filter(f => {
    const id = String(f.matchId)
    if (seen.has(id)) return false
    seen.add(id); return true
  })

  // Een intern al vastgelegd resultaat (result:{matchId}) is altijd
  // leidend boven de live wedstrijdstatus van football-data.org. Zonder dit
  // zou een wedstrijd waarvan de beheerder de uitslag al heeft ingevoerd
  // vóórdat de ECHTE aftraptijd is verstreken (of vóórdat de live-feed het
  // zelf als afgelopen meldt) nergens in de app als afgelopen/met eindstand
  // te zien zijn, terwijl de punten al wél verwerkt zijn.
  const resultsIndex = await kvGet('results:index') || []
  if (resultsIndex.length > 0) {
    const eigenResultaten = await Promise.all(resultsIndex.map(id => kvGet(`result:${id}`)))
    const resultatenMap = {}
    for (const r of eigenResultaten) {
      if (r) resultatenMap[String(r.matchId)] = r
    }
    alle = alle.map(f => {
      const eigen = resultatenMap[String(f.matchId)]
      if (!eigen) return f
      return {
        ...f,
        status: 'FT',
        // De rauwe eindstand uit de feed apart bewaren. Hieronder overschrijven
        // we `uitslag` met het intern vastgelegde resultaat, en zonder deze
        // kopie zou checkEnSlaUitslagenOp() nooit kunnen zien dat
        // football-data.org de eindstand achteraf heeft gecorrigeerd.
        feedUitslag: f.uitslag,
        bron: eigen.bron || 'automatisch',
        uitslag: { home: eigen.uitslag.home, away: eigen.uitslag.away, status: 'FT' },
      }
    })
  }

  alle.sort((a, b) => new Date(a.datumISO) - new Date(b.datumISO))
  alle = alle.map((f, i) => ({ ...f, volgnummer: i + 1 }))

  return alle
}

export async function zoekVolgnummer(matchId) {
  const alle = await haalAlleWedstrijden()
  const f = alle.find(w => String(w.matchId) === String(matchId))
  return f ? f.volgnummer : null
}

// Herberekent de lopende totalen van ALLE spelers over ALLE verwerkte
// wedstrijden, strikt in chronologische volgorde (op volgnummer), en
// schrijft dat overal opnieuw weg. Dit is de enige plek waar "totalen"
// (zowel de per-wedstrijd momentopname als het globale eindtotaal) wordt
// vastgesteld — zo kan een per-wedstrijd totaal nooit meer "vastvriezen"
// op een verouderd moment, ook niet als wedstrijden niet in volgorde zijn
// ingevoerd of een eerdere uitslag achteraf is aangepast.
export async function herberekenAlleTotalen() {
  const resultsIndex = await kvGet('results:index') || []
  const alleResults = await Promise.all(resultsIndex.map(id => kvGet(`result:${id}`)))
  // Sorteren op de echte wedstrijddatum (datumISO), niet op `volgnummer`.
  // `volgnummer` is een bevroren momentopname (positie in de wedstrijdenlijst
  // op het moment van opslaan) en kan bij twee wedstrijden toevallig
  // hetzelfde getal bevatten als de lijst tussentijds is gewijzigd — dat
  // maakt de sorteervolgorde, en dus de lopende optelling, onbetrouwbaar.
  // datumISO is altijd uniek/stabiel genoeg om chronologisch op te sorteren.
  const geldigeResults = alleResults
    .filter(Boolean)
    .sort((a, b) => new Date(a.datumISO) - new Date(b.datumISO))

  const lopendTotaal = {}
  const schrijfActies = []

  for (const result of geldigeResults) {
    const nieuweTotalen = {}
    for (const [playerId, p] of Object.entries(result.punten || {})) {
      lopendTotaal[playerId] = (lopendTotaal[playerId] || 0) + p
      nieuweTotalen[playerId] = lopendTotaal[playerId]
    }
    schrijfActies.push(kvSet(`result:${result.matchId}`, { ...result, totalen: nieuweTotalen }))
  }

  await Promise.all(schrijfActies)
}

// Enige, centrale plek waar een uitslag wordt verwerkt tot punten en totalen.
// ALLE geverifieerde spelers krijgen een entry: wie niet op tijd heeft
// voorspeld (of helemaal niet), krijgt hier expliciet 0 punten.
// Wordt herbruikt door zowel de automatische verwerking als Admin (handmatige
// invoer), zodat de puntenlogica nooit op twee plekken kan gaan afwijken.
export async function berekenEnSlaResultaatOp(fixtureInfo, uitslag, opties = {}) {
  const { matchId, volgnummer, datumISO, datum, competitie, thuis, uit } = fixtureInfo

  // Waar komt deze uitslag vandaan? Een door de beheerder ingevoerde uitslag
  // ('handmatig') heeft altijd het laatste woord: de automatische synchronisatie
  // met football-data.org laat die met rust. Wordt er geen bron meegegeven
  // (bijv. bij Herbereken), dan behouden we de bestaande markering.
  const bestaandResultaat = await kvGet(`result:${matchId}`)
  const bron = opties.bron || bestaandResultaat?.bron || 'automatisch'

  const spelers = await alleGeverifieerdeSpelers()
  const predicties = {}
  const toto = {}
  const punten = {}

  // Voorspellingen parallel ophalen (onafhankelijke keys) i.p.v. één kvGet per
  // speler na elkaar — scheelt bij een volledige poule een reeks sequentiële
  // KV-round-trips.
  const preds = await Promise.all(spelers.map(s => kvGet(`prediction:${matchId}:${s.id}`)))
  spelers.forEach((speler, i) => {
    const pred = preds[i]
    if (pred) {
      predicties[speler.id] = { home: pred.home, away: pred.away }
      toto[speler.id] = totoLabel(pred)
      punten[speler.id] = berekenPunten(pred, uitslag)
    } else {
      predicties[speler.id] = null
      toto[speler.id] = null
      punten[speler.id] = 0
    }
  })

  const result = {
    matchId, uitslag, volgnummer,
    predicties, toto, punten,
    totalen: {}, // wordt hieronder door herberekenAlleTotalen() gevuld
    datumISO, datum, competitie, thuis, uit,
    bron,
    verwerktOp: new Date().toISOString(),
  }

  await kvSet(`result:${matchId}`, result)

  const index = await kvGet('results:index') || []
  if (!index.includes(String(matchId))) {
    index.push(String(matchId))
    await kvSet('results:index', index)
  }

  await herberekenAlleTotalen()

  const definitief = await kvGet(`result:${matchId}`)

  // Spelers op de hoogte brengen. Bewust AWAIT en in een try/catch: op Vercel
  // mag de functie bevroren worden zodra het antwoord verstuurd is, dus
  // fire-and-forget zou berichten kunnen laten verdampen. Een mislukte
  // verzending mag het vastleggen van de uitslag echter nooit laten falen.
  // stuurUitslagNotificaties() bewaakt zelf dat er bij een ongewijzigde
  // herberekening niets opnieuw de deur uit gaat.
  try {
    await stuurUitslagNotificaties(definitief)
  } catch (e) {
    console.error('Uitslagmeldingen versturen mislukt:', e)
  }

  return definitief
}

// Hoe ver terug we een AL verwerkte uitslag nog naast de feed leggen.
// football-data.org corrigeert een eindstand zelden, en als het gebeurt dan
// binnen enkele dagen. Door alleen recente wedstrijden te hercontroleren blijft
// /api/fixtures snel: we hoeven niet elke speelronde van het seizoen opnieuw
// uit de database te lezen.
const HERCONTROLE_VENSTER_MS = 7 * 24 * 60 * 60 * 1000

export async function checkEnSlaUitslagenOp(fixtures) {
  const nu = Date.now()

  // Een wedstrijd komt in aanmerking zodra de feed hem als afgelopen meldt
  // (FINISHED of AWARDED) én er een echte eindstand bij zit. Er is bewust GEEN
  // wachttijd na de aftrap meer: die status is op zichzelf het definitieve
  // signaal, en mapMatch() laat de uitslag leeg zolang de score nog niet
  // ingevuld is. Een extra tijdslot zou de punten en meldingen alleen
  // vertragen zonder iets toe te voegen.
  //
  // Let op: voor een al verwerkte wedstrijd heeft haalAlleWedstrijden() het
  // veld `uitslag` vervangen door het intern vastgelegde resultaat; de rauwe
  // feedwaarde staat dan in `feedUitslag`.
  const kandidaten = fixtures.filter(f => {
    const feed = f.feedUitslag || f.uitslag
    return feed && feed.status === 'FT'
  })
  if (kandidaten.length === 0) return []

  // Eén read op de index i.p.v. een kvGet per wedstrijd. Bij een volledig
  // seizoen scheelde dat tientallen sequentiële KV-calls per aanroep van
  // /api/fixtures — precies de traagheid die het wegschrijven op Vercel
  // onbetrouwbaar maakte.
  const index = await kvGet('results:index') || []
  const alVerwerkt = new Set(index.map(String))

  const nieuw = kandidaten.filter(f => !alVerwerkt.has(String(f.matchId)))

  // Recent al verwerkte wedstrijden naast de feed leggen: corrigeert
  // football-data.org de eindstand achteraf, dan trekken we punten en
  // klassement vanzelf recht. Een door de beheerder ingevoerde uitslag
  // (bron 'handmatig') blijft daarbij altijd staan — die heeft het laatste
  // woord, precies de ontsnappingsroute bij een storing in de feed.
  const gewijzigd = kandidaten.filter(f => {
    if (!alVerwerkt.has(String(f.matchId))) return false
    if (f.bron === 'handmatig') return false
    if (nu - new Date(f.datumISO).getTime() > HERCONTROLE_VENSTER_MS) return false
    const feed = f.feedUitslag
    if (!feed) return false
    return feed.home !== f.uitslag?.home || feed.away !== f.uitslag?.away
  })

  const teVerwerken = [...nieuw, ...gewijzigd]
  if (teVerwerken.length === 0) return []

  // Chronologisch verwerken, zodat de lopende totalen in de juiste volgorde
  // worden opgebouwd als er meerdere wedstrijden tegelijk binnenkomen.
  teVerwerken.sort((a, b) => new Date(a.datumISO) - new Date(b.datumISO))

  const verwerkt = []
  for (const f of teVerwerken) {
    // Altijd de rauwe feedwaarde gebruiken: bij een correctie staat in
    // f.uitslag nog de oude, intern opgeslagen stand.
    const uitslag = f.feedUitslag || f.uitslag
    await berekenEnSlaResultaatOp(f, uitslag, { bron: 'automatisch' })
    verwerkt.push(String(f.matchId))
  }
  return verwerkt
}
