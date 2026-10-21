import { kvGet, kvSet } from './_kv.js'
import { alleGeverifieerdeSpelers } from './_players.js'
import { whatsappIngesteld, stuurWhatsappSjabloon } from './_whatsapp.js'
import { stuurUitslagMail } from './_email.js'
import { zoekNaam } from '../shared/teams.js'

// Verstuurt na het verwerken van een uitslag aan iedere speler een bericht met
// de eindstand, de voorspellingen en punten van ALLE deelnemers, en het nieuwe
// klassement.
//
// Kanaal: WhatsApp als dat is ingesteld én de speler een nummer heeft
// opgegeven; anders e-mail. Spelers die meldingen hebben uitgezet krijgen
// niets.

// Vingerafdruk van wat we de spelers zouden vertellen: de uitslag plus ieders
// punten. Hiermee onderscheiden we drie gevallen:
//   - nog geen vingerafdruk  -> eerste verwerking, versturen
//   - andere vingerafdruk    -> uitslag/punten echt gewijzigd, correctie sturen
//   - zelfde vingerafdruk    -> kale herberekening, NIETS sturen
// Dat laatste is belangrijk: berekenEnSlaResultaatOp() draait ook bij elke
// herberekening (beheerder corrigeert een voorspelling, klikt op Herbereken,
// verwijdert een voorspelling). Zonder dit slot zou iedereen telkens opnieuw
// een bericht krijgen.
export function maakHandtekening(result) {
  const punten = Object.keys(result.punten || {})
    .sort()
    .map(id => `${id}:${result.punten[id]}`)
    .join(',')
  return `${result.uitslag?.home}-${result.uitslag?.away}|${punten}`
}

// Meldingen horen bij een NET verwerkte uitslag. Een wedstrijd die al langer
// geleden gespeeld is en nog géén vingerafdruk heeft, is er een van vóór deze
// functie bestond (of een herberekening daarvan) — daar hoort niemand alsnog
// een bericht over te krijgen. Zulke wedstrijden adopteren we stil: we leggen
// de vingerafdruk vast zonder te versturen, zodat een latere ECHTE correctie
// daarop wél netjes een correctiebericht oplevert.
//
// Ruim genomen: een verse uitslag wordt uiterlijk bij de cron van 05:00 de
// volgende ochtend verwerkt, dus binnen een etmaal. Drie dagen marge is
// daarmee veilig.
const MAX_LEEFTIJD_VOOR_MELDING_MS = 3 * 24 * 60 * 60 * 1000

// Geëxporteerd om apart getest te kunnen worden.
export function isTeOudVoorMelding(datumISO, nu = Date.now()) {
  if (!datumISO) return false
  return nu - new Date(datumISO).getTime() > MAX_LEEFTIJD_VOOR_MELDING_MS
}

// Positie in het klassement, met gedeelde plaatsen: bij gelijke punten krijgen
// spelers dezelfde positie en slaat de volgende positie(s) over (1, 2, 2, 4).
export function bepaalPosities(totalen) {
  const gesorteerd = Object.entries(totalen || {}).sort((a, b) => b[1] - a[1])
  const posities = {}
  let vorigePunten = null
  let vorigePositie = 0
  gesorteerd.forEach(([playerId, punten], i) => {
    const positie = punten === vorigePunten ? vorigePositie : i + 1
    posities[playerId] = positie
    vorigePunten = punten
    vorigePositie = positie
  })
  return posities
}

// Het klassement als lijst, aflopend op punten en met gedeelde plaatsen.
export function maakKlassement(totalen, naamPerSpeler = {}) {
  const posities = bepaalPosities(totalen)
  return Object.entries(totalen || {})
    .sort((a, b) => b[1] - a[1])
    .map(([playerId, punten]) => ({
      playerId,
      positie: posities[playerId],
      naam: naamPerSpeler[playerId] || '???',
      punten,
    }))
}

// Wat ALLE deelnemers bij deze wedstrijd voorspelden en opleverde, aflopend op
// behaalde punten (de beste voorspelling bovenaan), bij gelijke punten op naam.
export function maakVoorspellingen(result, naamPerSpeler = {}) {
  return Object.keys(result?.punten || {})
    .map(playerId => {
      const pred = result.predicties?.[playerId]
      return {
        playerId,
        naam: naamPerSpeler[playerId] || '???',
        voorspelling: pred ? `${pred.home}-${pred.away}` : 'geen voorspelling',
        punten: result.punten?.[playerId] ?? 0,
      }
    })
    .sort((a, b) => b.punten - a.punten || a.naam.localeCompare(b.naam))
}

// Dezelfde lijsten op ÉÉN regel, voor in een WhatsApp-sjabloon.
// Sjabloonvariabelen mogen namelijk geen regeleindes bevatten, dus scheiden we
// de spelers met een punt in plaats van met een nieuwe regel.
export function maakKlassementRegel(totalen, naamPerSpeler = {}) {
  return maakKlassement(totalen, naamPerSpeler)
    .map(r => `${r.positie}. ${r.naam} ${r.punten}`)
    .join(' · ')
}

export function maakVoorspellingenRegel(result, naamPerSpeler = {}) {
  return maakVoorspellingen(result, naamPerSpeler)
    .map(r => `${r.naam} ${r.voorspelling} (${r.punten} pt)`)
    .join(' · ')
}

// Eén plek die een resultaat omzet naar alles wat een bericht nodig heeft.
// Zowel de echte melding als het proefbericht gebruiken dit, zodat de twee
// nooit uit elkaar kunnen lopen.
export function maakBerichtGegevens(result, speler, { naamPerSpeler = {}, isCorrectie = false } = {}) {
  const wedstrijd = `${zoekNaam(result.thuis)} – ${zoekNaam(result.uit)}`
  return {
    naam: speler.naam,
    playerId: speler.id,
    wedstrijd: isCorrectie ? `${wedstrijd} (gecorrigeerd)` : wedstrijd,
    datum: result.datum || '',
    eindstand: `${result.uitslag.home}-${result.uitslag.away}`,
    voorspellingen: maakVoorspellingen(result, naamPerSpeler),
    klassement: maakKlassement(result.totalen, naamPerSpeler),
    isCorrectie,
  }
}

// De vier variabelen van het WhatsApp-sjabloon, in volgorde.
function maakSjabloonVariabelen(gegevens, result, naamPerSpeler) {
  return [
    gegevens.wedstrijd,
    gegevens.eindstand,
    maakVoorspellingenRegel(result, naamPerSpeler),
    maakKlassementRegel(result.totalen, naamPerSpeler),
  ]
}

async function verstuurAan(speler, gegevens, result, naamPerSpeler) {
  if (whatsappIngesteld() && speler.telefoon) {
    await stuurWhatsappSjabloon(speler.telefoon, maakSjabloonVariabelen(gegevens, result, naamPerSpeler))
    return { kanaal: 'whatsapp', naar: `+${speler.telefoon}` }
  }
  await stuurUitslagMail(speler.email, gegevens)
  return { kanaal: 'email', naar: speler.email }
}

export async function stuurUitslagNotificaties(result) {
  if (!result?.matchId || !result.uitslag) return { verstuurd: 0, reden: 'geen resultaat' }

  const sleutel = `notificatie:${result.matchId}`
  const vorige = await kvGet(sleutel)
  const handtekening = maakHandtekening(result)

  if (vorige?.handtekening === handtekening) {
    return { verstuurd: 0, reden: 'ongewijzigd' }
  }
  const isCorrectie = Boolean(vorige)

  // Stille adoptie van een oude wedstrijd die nog geen vingerafdruk had.
  if (!vorige && isTeOudVoorMelding(result.datumISO)) {
    await kvSet(sleutel, {
      handtekening,
      verstuurdOp: null,
      reden: 'te oud bij eerste registratie',
      aantal: 0,
    })
    return { verstuurd: 0, reden: 'te oud' }
  }

  const spelers = await alleGeverifieerdeSpelers()
  const naamPerSpeler = Object.fromEntries(spelers.map(s => [s.id, s.naam]))

  const ontvangers = spelers.filter(s => s.notificaties !== false)
  const viaWhatsapp = whatsappIngesteld()

  const resultaten = await Promise.allSettled(ontvangers.map(speler => {
    const gegevens = maakBerichtGegevens(result, speler, { naamPerSpeler, isCorrectie })
    return verstuurAan(speler, gegevens, result, naamPerSpeler)
  }))

  const gelukt = resultaten.filter(r => r.status === 'fulfilled').length
  for (const r of resultaten) {
    if (r.status === 'rejected') console.error('Uitslagmelding mislukt:', r.reason)
  }

  // Pas NA het versturen vastleggen, zodat een volledig mislukte ronde bij een
  // volgende verwerking opnieuw geprobeerd wordt.
  await kvSet(sleutel, {
    handtekening,
    verstuurdOp: new Date().toISOString(),
    kanaal: viaWhatsapp ? 'whatsapp' : 'email',
    aantal: gelukt,
  })

  return { verstuurd: gelukt, van: ontvangers.length, correctie: isCorrectie }
}

// De laatst gespeelde wedstrijd waarvan de uitslag verwerkt is.
async function haalLaatsteResultaat() {
  const index = await kvGet('results:index') || []
  if (index.length === 0) return null
  const results = (await Promise.all(index.map(id => kvGet(`result:${id}`)))).filter(Boolean)
  if (results.length === 0) return null
  return results.sort((a, b) => new Date(b.datumISO) - new Date(a.datumISO))[0]
}

// Een verzonnen wedstrijd, alleen nodig zolang er nog geen enkele uitslag
// verwerkt is. Zo levert de testknop ook in een lege poule een echt bericht op.
function voorbeeldResultaat(speler) {
  return {
    matchId: 'voorbeeld',
    thuis: 'PSV', uit: 'AJA',
    datum: 'proefbericht',
    uitslag: { home: 3, away: 1 },
    predicties: { [speler.id]: { home: 2, away: 1 }, voorbeeld: { home: 1, away: 1 } },
    punten: { [speler.id]: 7, voorbeeld: 0 },
    totalen: { [speler.id]: 42, voorbeeld: 38 },
  }
}

// Stuurt één proefbericht naar de beheerder zelf, gebaseerd op de LAATST
// gespeelde wedstrijd en de echte stand — zo zie je precies wat de deelnemers
// straks krijgen. Bewust los van stuurUitslagNotificaties(): geen
// vingerafdruk, geen andere ontvangers, en fouten worden doorgegeven in plaats
// van alleen gelogd, zodat de beheerder ziet wat Meta terugmeldt bij een
// verkeerd token of een sjabloonnaam die net anders is.
export async function stuurTestMelding(speler) {
  const spelers = await alleGeverifieerdeSpelers()
  const naamPerSpeler = Object.fromEntries(spelers.map(s => [s.id, s.naam]))

  const echt = await haalLaatsteResultaat()
  const result = echt || voorbeeldResultaat(speler)
  if (!echt) naamPerSpeler.voorbeeld = 'Voorbeeldspeler'

  const gegevens = maakBerichtGegevens(result, speler, { naamPerSpeler })
  const info = await verstuurAan(speler, gegevens, result, naamPerSpeler)

  return {
    ...info,
    gebaseerdOp: echt
      ? `${gegevens.wedstrijd} (${result.datum || 'laatste wedstrijd'})`
      : 'voorbeeldgegevens — er is nog geen uitslag verwerkt',
    echteData: Boolean(echt),
  }
}
