import { kvGet, kvSet } from './_kv.js'
import { fetchMetTimeout } from './_fetch.js'
import { TEAMS, normaliseer, zoekVerzorgdeNaam } from '../shared/teams.js'

// Haalt de wedstrijden op waar het vloek-scherm op rekent: Eredivisie en
// KNVB-beker van dit seizoen en de twee daarvoor, van ALLE clubs — niet alleen
// van PSV. We moeten immers ook weten wat de club die van PSV won daarna deed.
//
// Twee bronnen, want geen van beide heeft alles:
//   - Eredivisie komt van football-data.org. Eén aanroep levert het hele
//     seizoen van alle clubs; dat is precies wat we nodig hebben.
//   - De KNVB-beker zit daar niet in. Die komt van ESPN, dezelfde bron als de
//     opstellingen.
//
// Afgelopen seizoenen veranderen niet meer, dus die worden lang bewaard. Het
// lopende seizoen een uur.
const API_BASE = 'https://api.football-data.org/v4'
const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/soccer'

// Een afgesloten seizoen wordt één keer opgehaald en daarna nooit meer: die
// uitslagen veranderen niet. Alleen het lopende seizoen wordt ververst, en
// een mislukte poging wordt na een paar uur opnieuw geprobeerd.
const TTL_LOPEND_MS = 60 * 60 * 1000
const TTL_MISLUKT_MS = 6 * 60 * 60 * 1000

const MAANDEN = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']

export function formatDatum(datumISO) {
  const d = new Date(datumISO)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getDate()} ${MAANDEN[d.getMonth()]} ${d.getFullYear()}`
}

// Eén sleutel per club. Bekende clubs krijgen hun eigen afkorting, zodat de
// twee bronnen op elkaar aansluiten ("Ajax" en "AFC Ajax" worden allebei AJA).
//
// Bewust NIET via zoekAfkorting(): die valt bij een onbekende club terug op de
// eerste drie letters, en in de beker spelen amateurclubs mee. "Spakenburg"
// zou dan SPA worden — net als Sparta — en dan plakken we de wedstrijden van
// twee clubs aan elkaar. Een onbekende club krijgt hier zijn eigen naam als
// sleutel, met een tilde ervoor zodat hij nooit op een echte code lijkt.
export function clubSleutel(naam) {
  const genormaliseerd = normaliseer(naam || '')
  if (!genormaliseerd) return '???'
  for (const [code, team] of Object.entries(TEAMS)) {
    if (team.aliases.some(alias => normaliseer(alias) === genormaliseerd)) return code
  }
  return `~${genormaliseerd}`
}

// ---------------------------------------------------------------------------
// football-data.org — Eredivisie
// ---------------------------------------------------------------------------
export function normaliseerFootballData(m) {
  const afgelopen = m?.status === 'FINISHED' || m?.status === 'AWARDED'
  const home = m?.score?.fullTime?.home
  const away = m?.score?.fullTime?.away
  const winnaarVeld = m?.score?.winner

  let winnaar = null
  if (afgelopen) {
    if (winnaarVeld === 'HOME_TEAM') winnaar = 'HOME'
    else if (winnaarVeld === 'AWAY_TEAM') winnaar = 'AWAY'
    else winnaar = 'DRAW'
  }

  return {
    datumISO: m?.utcDate,
    datum: formatDatum(m?.utcDate),
    competitie: 'ERE',
    thuis: clubSleutel(m?.homeTeam?.name),
    uit: clubSleutel(m?.awayTeam?.name),
    thuisNaam: zoekVerzorgdeNaam(m?.homeTeam?.name) || m?.homeTeam?.name || '',
    uitNaam: zoekVerzorgdeNaam(m?.awayTeam?.name) || m?.awayTeam?.name || '',
    home: Number.isFinite(home) ? home : null,
    away: Number.isFinite(away) ? away : null,
    winnaar,
    gespeeld: afgelopen,
    naStrafschoppen: false,
  }
}

async function haalEredivisie(seizoen) {
  const sleutel = process.env.FOOTBALL_DATA_KEY
  if (!sleutel) return { wedstrijden: [], reden: 'geen API-sleutel' }

  const res = await fetchMetTimeout(`${API_BASE}/competitions/DED/matches?season=${seizoen}`, {
    headers: { 'X-Auth-Token': sleutel },
  })
  const data = await res.json()
  // Een afgeschermd seizoen geeft geen foutstatus maar een foutmelding in de
  // body. Die geven we door, zodat het scherm kan zeggen wat er ontbreekt in
  // plaats van stilletjes een seizoen over te slaan.
  if (data?.errorCode || data?.error) {
    return { wedstrijden: [], reden: data.message || `football-data gaf ${data.errorCode || data.error}` }
  }
  return { wedstrijden: (data.matches || []).map(normaliseerFootballData) }
}

// ---------------------------------------------------------------------------
// ESPN — KNVB-beker
// ---------------------------------------------------------------------------
export function normaliseerEspn(event, competitie = 'KNVB') {
  const duel = event?.competitions?.[0]
  const ploegen = duel?.competitors || []
  const thuis = ploegen.find(c => c.homeAway === 'home')
  const uit = ploegen.find(c => c.homeAway === 'away')
  if (!thuis || !uit) return null

  const staat = duel?.status?.type?.state
  const afgelopen = duel?.status?.type?.completed === true || staat === 'post'
  const home = Number(thuis.score)
  const away = Number(uit.score)

  let winnaar = null
  let naStrafschoppen = false
  if (afgelopen && Number.isFinite(home) && Number.isFinite(away)) {
    if (home > away) winnaar = 'HOME'
    else if (away > home) winnaar = 'AWAY'
    else {
      // Gelijkspel in de beker: ESPN zet een vlaggetje bij wie doorging. Dat
      // is de winnaar van de strafschoppen, en die telt als winnaar — zo is
      // het afgesproken, en je gaat er net zo hard uit.
      const door = ploegen.find(c => c.winner === true)
      if (door) {
        winnaar = door.homeAway === 'home' ? 'HOME' : 'AWAY'
        naStrafschoppen = true
      } else {
        winnaar = 'DRAW'
      }
    }
  }

  const naam = c => c.team?.displayName || c.team?.name || c.team?.shortDisplayName || ''
  return {
    datumISO: event?.date,
    datum: formatDatum(event?.date),
    competitie,
    thuis: clubSleutel(naam(thuis)),
    uit: clubSleutel(naam(uit)),
    thuisNaam: zoekVerzorgdeNaam(naam(thuis)) || naam(thuis),
    uitNaam: zoekVerzorgdeNaam(naam(uit)) || naam(uit),
    home: Number.isFinite(home) ? home : null,
    away: Number.isFinite(away) ? away : null,
    winnaar,
    gespeeld: afgelopen,
    naStrafschoppen,
  }
}

// De maanden waarin een seizoen gespeeld wordt, als JJJJMM.
export function seizoenMaanden(seizoen) {
  const maanden = []
  for (let m = 8; m <= 12; m++) maanden.push(`${seizoen}${String(m).padStart(2, '0')}`)
  for (let m = 1; m <= 6; m++) maanden.push(`${seizoen + 1}${String(m).padStart(2, '0')}`)
  return maanden
}

async function espnEvents(pad) {
  const res = await fetchMetTimeout(`${ESPN}/${pad}`)
  if (!res.ok) throw new Error(`ESPN gaf status ${res.status}`)
  const data = await res.json()
  return data?.events || []
}

// ESPN levert zijn scorebord normaal per dag, en een seizoen heeft er 300. We
// proberen daarom eerst of hij een hele periode in één keer teruggeeft, en
// anders per maand. Lukt geen van beide, dan melden we dat — per dag ophalen
// zou honderden aanroepen kosten en dat is deze grap niet waard.
async function haalBeker(seizoen) {
  const begin = `${seizoen}0801`
  const eind = `${seizoen + 1}0701`

  try {
    const events = await espnEvents(`ned.cup/scoreboard?dates=${begin}-${eind}&limit=500`)
    if (events.length > 0) {
      return { wedstrijden: events.map(e => normaliseerEspn(e)).filter(Boolean), vorm: 'periode' }
    }
  } catch (_) { /* vorm werkt niet; we proberen per maand */ }

  const alles = []
  let gelukt = 0
  for (const maand of seizoenMaanden(seizoen)) {
    try {
      const events = await espnEvents(`ned.cup/scoreboard?dates=${maand}&limit=500`)
      gelukt++
      alles.push(...events.map(e => normaliseerEspn(e)).filter(Boolean))
    } catch (_) { /* één mislukte maand hoeft de rest niet te blokkeren */ }
  }
  if (gelukt === 0) return { wedstrijden: [], reden: 'ESPN gaf geen bekergegevens' }

  // Dubbele eruit: een periode- en een maandquery kunnen elkaar overlappen.
  const uniek = new Map()
  for (const w of alles) uniek.set(`${w.datumISO}|${w.thuis}|${w.uit}`, w)
  return { wedstrijden: [...uniek.values()], vorm: 'maand' }
}

// ---------------------------------------------------------------------------
// Samenstellen en bewaren
// ---------------------------------------------------------------------------
// `lopend` zegt of dit seizoen nog bezig is. Dat wordt ook bij de gegevens
// bewaard, want een seizoen dat tijdens de rit is opgehaald is onvolledig: die
// moet na afloop nog één keer opnieuw, anders bevriezen we een halve jaargang.
export function magUitCache(bewaard, lopend, nu = Date.now()) {
  if (!bewaard?.op) return false
  const gevuld = (bewaard.wedstrijden || []).length > 0
  const compleet = gevuld && bewaard.lopendBijOphalen === false

  // Afgesloten seizoen, volledig opgehaald: klaar, voorgoed.
  if (!lopend && compleet) return true

  const ttl = gevuld ? TTL_LOPEND_MS : TTL_MISLUKT_MS
  return nu - new Date(bewaard.op).getTime() < ttl
}

async function metCache(sleutel, lopend, ophalen) {
  const bewaard = await kvGet(sleutel)
  if (magUitCache(bewaard, lopend)) return { ...bewaard, uitCache: true }

  try {
    const vers = await ophalen()
    await kvSet(sleutel, { ...vers, lopendBijOphalen: lopend, op: new Date().toISOString() })
    return vers
  } catch (e) {
    // Liever verouderd dan niets: een seizoen dat we al hadden blijft staan.
    if (bewaard) return { ...bewaard, uitCache: true, verouderd: true }
    return { wedstrijden: [], reden: e?.message || 'ophalen mislukt' }
  }
}

export async function haalVloekWedstrijden(huidigSeizoen, aantalSeizoenen = 3) {
  const seizoenen = []
  for (let i = 0; i < aantalSeizoenen; i++) seizoenen.push(huidigSeizoen - i)

  const wedstrijden = []
  const bronnen = []

  for (const seizoen of seizoenen) {
    const lopend = seizoen === huidigSeizoen

    const ere = await metCache(`vloek:ere:${seizoen}`, lopend, () => haalEredivisie(seizoen))
    wedstrijden.push(...(ere.wedstrijden || []))
    bronnen.push({ seizoen, competitie: 'ERE', aantal: (ere.wedstrijden || []).length, reden: ere.reden || null })

    const beker = await metCache(`vloek:knvb:${seizoen}`, lopend, () => haalBeker(seizoen))
    wedstrijden.push(...(beker.wedstrijden || []))
    bronnen.push({ seizoen, competitie: 'KNVB', aantal: (beker.wedstrijden || []).length, reden: beker.reden || null })
  }

  return { wedstrijden, bronnen, seizoenen }
}
