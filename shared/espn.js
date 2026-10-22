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
    }))
    return {
      team: r.team?.displayName || '',
      logo: r.team?.logos?.[0]?.href || null,
      thuisUit: r.homeAway === 'home' ? 'thuis' : 'uit',
      formatie: r.formation || '',
      basis: spelers.filter(s => s.basis).sort((a, b) => a.plek - b.plek),
      bank: spelers.filter(s => !s.basis),
    }
  })
}
