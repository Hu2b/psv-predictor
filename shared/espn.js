// Hulpmiddelen om een wedstrijd uit ONZE agenda (football-data.org) terug te
// vinden bij ESPN, dat de opstellingen levert.
//
// De twee bronnen delen geen wedstrijd-id's, dus koppelen gebeurt op datum plus
// de twee teamnamen. Dat is de zwakke plek van deze functie: schrijft de ene
// bron "Ajax" waar de andere "Ajax Amsterdam" zegt, dan moet de vergelijking
// daar tegen kunnen. Vandaar dat namen eerst worden platgeslagen en vulwoorden
// als "fc" en "sc" eruit gaan, en dat er op losse woorden wordt vergeleken in
// plaats van op de hele naam.
import { TEAMS } from './teams.js'

// Competitiecode van ons -> het pad dat ESPN gebruikt. Staat een competitie er
// niet bij (zoals een oefenwedstrijd), dan is er geen opstelling op te halen en
// geeft deze functie null terug.
const ESPN_COMPETITIES = {
  ERE: 'ned.1',
  KNVB: 'ned.cup',
  CL: 'uefa.champions',
  UL: 'uefa.europa',
}

export function espnCompetitie(code) {
  return ESPN_COMPETITIES[code] || null
}

// ESPN wil een datum als 20261018. De wedstrijddatum is UTC; we nemen die
// datum letterlijk over, want ESPN zet een wedstrijd op de dag van de aftrap
// in UTC.
export function espnDatum(datumISO) {
  if (!datumISO) return null
  const d = new Date(datumISO)
  if (Number.isNaN(d.getTime())) return null
  const jaar = d.getUTCFullYear()
  const maand = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dag = String(d.getUTCDate()).padStart(2, '0')
  return `${jaar}${maand}${dag}`
}

// De dag van de aftrap plus de dag ervoor en erna. ESPN hangt een wedstrijd aan
// één scorebord-datum, maar welke dat is hangt af van de tijdzone waarin hij is
// weggeschreven. Bij een late avondwedstrijd kan dat een dag schelen. Dit wordt
// alleen gebruikt als de eigen dag niets oplevert, dus het kost normaal niets.
export function espnDatumVarianten(datumISO) {
  const d = new Date(datumISO)
  if (Number.isNaN(d.getTime())) return []
  const dag = 24 * 60 * 60 * 1000
  return [0, -dag, dag].map(verschil => espnDatum(new Date(d.getTime() + verschil).toISOString()))
}

// Woorden die niets onderscheidends zeggen en die de twee bronnen willekeurig
// wel of niet meenemen.
const VULWOORDEN = new Set(['fc', 'sc', 'afc', 'cf', 'ac', 'vv', 'bv', 'rkc', 'de', 'the'])

function woorden(naam) {
  return String(naam ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(w => w && !VULWOORDEN.has(w))
}

// Hoort deze ESPN-teamnaam bij onze teamcode? Waar als alle woorden van de één
// in de ander voorkomen: "ajax" past dan op "ajax amsterdam", maar "twente"
// nooit op "utrecht".
export function teamKomtOvereen(espnNaam, code) {
  const espn = woorden(espnNaam)
  if (espn.length === 0) return false

  const kandidaten = [TEAMS[code]?.naam, ...(TEAMS[code]?.aliases || []), code].filter(Boolean)
  return kandidaten.some(kandidaat => {
    const onze = woorden(kandidaat)
    if (onze.length === 0) return false
    return onze.every(w => espn.includes(w)) || espn.every(w => onze.includes(w))
  })
}

// Zoekt in een ESPN-scorebord de wedstrijd tussen deze twee teams. Beide teams
// moeten kloppen, anders geven we niets terug — een half-rake treffer is
// gevaarlijker dan geen treffer, want dan zou er een opstelling van de
// verkeerde wedstrijd in beeld komen.
export function zoekEspnWedstrijd(events, thuisCode, uitCode) {
  for (const e of events || []) {
    const deelnemers = e?.competitions?.[0]?.competitors || []
    const thuis = deelnemers.find(c => c.homeAway === 'home')?.team
    const uit = deelnemers.find(c => c.homeAway === 'away')?.team
    if (!thuis || !uit) continue

    const naam = t => t.displayName || t.name || ''
    const rechtdoor = teamKomtOvereen(naam(thuis), thuisCode) && teamKomtOvereen(naam(uit), uitCode)
    // Omgedraaid kan voorkomen als een van beide bronnen thuis en uit anders
    // noteert (bij een neutraal veld bijvoorbeeld).
    const omgedraaid = teamKomtOvereen(naam(thuis), uitCode) && teamKomtOvereen(naam(uit), thuisCode)
    if (rechtdoor || omgedraaid) return e.id
  }
  return null
}

// Is deze opstelling definitief? ESPN heeft daar geen apart veld voor, maar de
// wedstrijdstatus zegt genoeg: zolang de wedstrijd nog niet begonnen is ('pre')
// gaat het om de opgegeven elf, en die kan tot de aftrap nog veranderen —
// blessure bij de warming-up, een late wissel in de basis. Vanaf de aftrap
// ('in') en daarna ('post') ligt hij vast.
//
// Bij twijfel geven we 'voorlopig' terug. Ten onrechte "definitief" melden is
// erger dan andersom: dan vertrouwt iemand op een elftal dat nog wijzigt.
export function opstellingIsDefinitief(samenvatting) {
  const status = samenvatting?.header?.competitions?.[0]?.status?.type?.state
  return status === 'in' || status === 'post'
}

// 'voor' = nog niet begonnen, 'bezig' = loopt, 'afgelopen' = klaar. Bepaalt
// hoe vaak de app bijwerkt en wat er boven de opstelling staat. Onbekend telt
// als 'voor': dan wordt er wél bijgewerkt en blijft er niets hangen.
export function espnStatus(samenvatting) {
  const staat = samenvatting?.header?.competitions?.[0]?.status?.type?.state
  if (staat === 'in') return 'bezig'
  if (staat === 'post') return 'afgelopen'
  return 'voor'
}

// Dezelfde drie woorden, maar afgeleid uit onze eigen agenda in plaats van uit
// ESPN. Nodig als ESPN de wedstrijd niet kent: dan weet de app tenminste dat ze
// naar iets gespeelds kijkt, en zegt het blok niet "nog niet bekend" over een
// wedstrijd van vorige maand. De statuscodes komen van football-data.org; staat
// er niets bruikbaar in, dan beslist de klok (drie uur na de aftrap is elke
// wedstrijd voorbij).
const AFGELOPEN = ['FT', 'AET', 'PEN']
const BEZIG = ['1H', 'HT', '2H', 'ET', 'BT', 'LIVE']
const SPEELDUUR_MS = 3 * 60 * 60 * 1000

export function wedstrijdStatus(fixture, nu = Date.now()) {
  if (AFGELOPEN.includes(fixture?.status)) return 'afgelopen'
  if (BEZIG.includes(fixture?.status)) return 'bezig'
  const aftrap = fixture?.datumISO ? new Date(fixture.datumISO).getTime() : NaN
  if (!Number.isNaN(aftrap) && aftrap < nu - SPEELDUUR_MS) return 'afgelopen'
  return 'voor'
}

// "83'" en "90'+3'" worden 83 en 90, genoeg om wissels op volgorde te zetten.
export function minuutNummer(tekst) {
  const match = String(tekst ?? '').match(/\d+/)
  return match ? Number(match[0]) : 0
}

// Alleen de achternaam, voor de bank. Daar gaat het om wie er zit, niet om de
// volledige naam, en zo past het rijtje op één regel. Eén woord blijft heel
// (veel Brazilianen hebben maar één naam).
export function achternaam(naam) {
  const delen = String(naam ?? '').trim().split(/\s+/).filter(Boolean)
  return delen.length > 1 ? delen[delen.length - 1] : (delen[0] || '')
}

// PSV bovenaan, ongeacht of ze thuis of uit spelen. Het is een PSV-poule; je
// kijkt naar de eigen ploeg en pas daarna naar de tegenstander.
export function psvEerst(opstellingen) {
  return [...(opstellingen || [])].sort((a, b) => {
    const aPsv = teamKomtOvereen(a.team, 'PSV') ? 0 : 1
    const bPsv = teamKomtOvereen(b.team, 'PSV') ? 0 : 1
    return aPsv - bPsv
  })
}

// Zet het rosters-blok van ESPN om naar wat de app toont: per ploeg de
// formatie, de basisopstelling op rugnummer-volgorde van het veld, en de bank.
export function maakOpstelling(rosters) {
  return (rosters || []).map(r => {
    const spelers = (r.roster || []).map(s => ({
      naam: s.athlete?.displayName || s.athlete?.shortName || '???',
      rugnummer: s.jersey || '',
      positie: s.position?.abbreviation || '',
      positieNaam: s.position?.displayName || '',
      basis: Boolean(s.starter),
      plek: Number(s.formationPlace || 0),
      ingevallen: Boolean(s.subbedIn),
      gewisseld: Boolean(s.subbedOut),
      // De minuut staat bij de speler zelf, in zijn lijstje gebeurtenissen.
      minuut: (s.plays || []).find(p => p.substitution)?.clock?.displayValue || '',
      vervangenDoor: s.subbedOutFor?.athlete?.displayName || null,
      gekomenVoor: s.subbedInFor?.athlete?.displayName || null,
    }))

    // De wissels op een rij, op volgorde van de klok. We leiden ze af uit de
    // spelers die ERIN kwamen: daar staat bij wie ze vervingen, dus één regel
    // per wissel in plaats van twee halve.
    const wissels = spelers
      .filter(s => s.ingevallen && s.gekomenVoor)
      .map(s => ({ minuut: s.minuut, erin: s.naam, eruit: s.gekomenVoor }))
      .sort((a, b) => minuutNummer(a.minuut) - minuutNummer(b.minuut))

    return {
      team: r.team?.displayName || '',
      logo: r.team?.logos?.[0]?.href || null,
      thuisUit: r.homeAway === 'home' ? 'thuis' : 'uit',
      formatie: r.formation || '',
      basis: spelers.filter(s => s.basis).sort((a, b) => a.plek - b.plek),
      bank: spelers.filter(s => !s.basis),
      wissels,
    }
  })
}
