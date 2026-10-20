import { kvGet, kvSet } from './_kv.js'
import { alleGeverifieerdeSpelers } from './_players.js'
import { whatsappIngesteld, stuurWhatsappSjabloon } from './_whatsapp.js'
import { stuurUitslagMail } from './_email.js'
import { zoekNaam } from '../shared/teams.js'

// Verstuurt na het verwerken van een uitslag aan iedere speler een persoonlijk
// bericht: de eindstand, zijn eigen voorspelling, de behaalde punten en zijn
// nieuwe positie in het klassement.
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
  if (!vorige) {
    if (isTeOudVoorMelding(result.datumISO)) {
      await kvSet(sleutel, {
        handtekening,
        verstuurdOp: null,
        reden: 'te oud bij eerste registratie',
        aantal: 0,
      })
      return { verstuurd: 0, reden: 'te oud' }
    }
  }

  const spelers = await alleGeverifieerdeSpelers()
  const posities = bepaalPosities(result.totalen)
  const wedstrijd = `${zoekNaam(result.thuis)} – ${zoekNaam(result.uit)}`
  const eindstand = `${result.uitslag.home}-${result.uitslag.away}`

  const ontvangers = spelers.filter(s => s.notificaties !== false)
  const viaWhatsapp = whatsappIngesteld()

  const resultaten = await Promise.allSettled(ontvangers.map(async speler => {
    const pred = result.predicties?.[speler.id]
    const gegevens = {
      naam: speler.naam,
      wedstrijd: isCorrectie ? `${wedstrijd} (gecorrigeerd)` : wedstrijd,
      eindstand,
      voorspelling: pred ? `${pred.home}-${pred.away}` : 'geen voorspelling',
      punten: String(result.punten?.[speler.id] ?? 0),
      positie: `${posities[speler.id] ?? '-'}e`,
      totaal: String(result.totalen?.[speler.id] ?? 0),
      isCorrectie,
    }

    if (viaWhatsapp && speler.telefoon) {
      return await stuurWhatsappSjabloon(speler.telefoon, [
        gegevens.wedstrijd,
        gegevens.eindstand,
        gegevens.voorspelling,
        gegevens.punten,
        gegevens.positie,
        gegevens.totaal,
      ])
    }
    return await stuurUitslagMail(speler.email, gegevens)
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
