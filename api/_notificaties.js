import { kvGet, kvSet } from './_kv.js'
import { alleGeverifieerdeSpelers } from './_players.js'
import { whatsappIngesteld, stuurWhatsappSjabloon, SJABLOON_UITSLAG, SJABLOON_VOORSPELLINGEN, SJABLOON_HERINNERING } from './_whatsapp.js'
import { stuurUitslagMail, stuurVoorspellingenMail, stuurHerinneringMail } from './_email.js'
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

// Zolang een sjabloon nog niet is goedgekeurd stuurt de app vrije tekst. De
// opmaak is gelijk aan die van het sjabloon, zodat een testbericht er hetzelfde
// uitziet als wat de deelnemers straks echt krijgen. Vrije tekst mag wél
// regeleindes bevatten — die beperking geldt alleen voor sjabloonvariabelen.
export function maakUitslagTekst(v) {
  const w = (v || []).map(x => String(x ?? '').trim())
  if (w.length !== 4) return w.filter(Boolean).join('\n')
  return [
    `⚽ De uitslag van ${w[0]} is verwerkt en de punten zijn bijgewerkt.`,
    '',
    `Eindstand: ${w[1]}`,
    '',
    'Dit had iedereen voorspeld, met de punten die dat opleverde:',
    w[2],
    '',
    '🏆 Zo staat de poule er nu voor:',
    w[3],
    '',
    'Bekijk het volledige overzicht in de app. Succes bij de volgende wedstrijd!',
  ].join('\n')
}

// Bewust ZONDER link naar de app. Meta herclassificeerde een eerdere versie
// mét URL van Utility naar Marketing — een sjabloon dat mensen wegstuurt uit
// het gesprek leest voor hen als promotie, en marketingberichten zijn duurder
// en vallen onder aparte limieten. Het uitslagsjabloon verwijst daarom ook
// alleen naar "de app" zonder adres. De e-mailversie linkt wél gewoon door.
export function maakVoorspellingenTekst(v) {
  const w = (v || []).map(x => String(x ?? '').trim())
  if (w.length !== 2) return w.filter(Boolean).join('\n')
  return [
    `⚽ Iedereen heeft voorspeld voor ${w[0]}, dus de voorspellingen zijn nu zichtbaar voor alle deelnemers.`,
    '',
    'Dit is er voorspeld:',
    w[1],
    '',
    'Je kunt je eigen voorspelling voor deze wedstrijd niet meer wijzigen.',
  ].join('\n')
}

// `terugvalOpEmail` bepaalt wat er gebeurt als WhatsApp weigert. Bij de echte
// uitslagmelding willen we dat niemand z'n bericht misloopt: faalt WhatsApp,
// dan gaat het alsnog per mail. Bij het proefbericht juist niet — daar moet de
// beheerder de foutmelding van Twilio onverkort zien, anders ziet hij een
// geslaagde mail en denkt hij dat WhatsApp werkt.
//
// Dit is geen theoretisch geval. Zolang er nog geen goedgekeurd sjabloon is
// stuurt de app vrije tekst, en die weigert WhatsApp buiten het venster van 24
// uur. Zonder deze terugval zou iedereen met een telefoonnummer dan stilletjes
// niets krijgen — slechter af dan voorheen, toen het gewoon e-mail was.
async function verstuurAan(speler, gegevens, result, naamPerSpeler, { terugvalOpEmail = false } = {}) {
  if (whatsappIngesteld() && speler.telefoon) {
    try {
      const variabelen = maakSjabloonVariabelen(gegevens, result, naamPerSpeler)
      await stuurWhatsappSjabloon(speler.telefoon, variabelen, {
        soort: SJABLOON_UITSLAG,
        vrijeTekst: maakUitslagTekst(variabelen),
      })
      return { kanaal: 'whatsapp', naar: `+${speler.telefoon}` }
    } catch (e) {
      if (!terugvalOpEmail) throw e
      console.error(`WhatsApp mislukt voor ${speler.id}, valt terug op e-mail:`, e?.message || e)
    }
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
    return verstuurAan(speler, gegevens, result, naamPerSpeler, { terugvalOpEmail: true })
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

// ---------------------------------------------------------------------------
// Melding zodra IEDEREEN heeft voorspeld
// ---------------------------------------------------------------------------
//
// Op dat moment worden de voorspellingen in de app onthuld (zie prediction.js:
// `onthuld` is waar zodra de aftrap voorbij is, iedereen heeft voorspeld, óf
// er een uitslag ligt). Dit bericht vertelt dat ze zichtbaar zijn en toont ze
// meteen, met een link naar de app.

// Iedereens voorspelling op één regel, op naam gesorteerd. Eén regel, want een
// sjabloonvariabele mag geen regeleindes bevatten.
export function maakAlleVoorspellingenRegel(predicties, naamPerSpeler = {}) {
  return Object.entries(predicties || {})
    .map(([playerId, p]) => ({
      naam: naamPerSpeler[playerId] || '???',
      score: p && Number.isInteger(p.home) && Number.isInteger(p.away) ? `${p.home}-${p.away}` : '—',
    }))
    .sort((a, b) => a.naam.localeCompare(b.naam))
    .map(r => `${r.naam} ${r.score}`)
    .join(' · ')
}

// Dezelfde vingerafdrukgedachte als bij de uitslagmelding: verandert er niets,
// dan gaat er niets uit. Zo levert een herberekening of een tweede aanroep
// geen dubbel bericht op.
export function maakVoorspellingenHandtekening(predicties) {
  return Object.keys(predicties || {})
    .sort()
    .map(id => `${id}:${predicties[id]?.home}-${predicties[id]?.away}`)
    .join(',')
}

export async function stuurVoorspellingenNotificaties(fixture, predicties) {
  if (!fixture?.matchId) return { verstuurd: 0, reden: 'geen wedstrijd' }

  const sleutel = `notificatie:voorspellingen:${fixture.matchId}`
  const vorige = await kvGet(sleutel)
  const handtekening = maakVoorspellingenHandtekening(predicties)
  if (vorige?.handtekening === handtekening) return { verstuurd: 0, reden: 'ongewijzigd' }

  const spelers = await alleGeverifieerdeSpelers()
  const naamPerSpeler = Object.fromEntries(spelers.map(s => [s.id, s.naam]))

  const wedstrijd = `${zoekNaam(fixture.thuis)} – ${zoekNaam(fixture.uit)}`
  const regel = maakAlleVoorspellingenRegel(predicties, naamPerSpeler)
  const variabelen = [wedstrijd, regel]
  const vrijeTekst = maakVoorspellingenTekst(variabelen)

  const ontvangers = spelers.filter(s => s.notificaties !== false)
  const resultaten = await Promise.allSettled(ontvangers.map(async speler => {
    if (whatsappIngesteld() && speler.telefoon) {
      try {
        await stuurWhatsappSjabloon(speler.telefoon, variabelen, {
          soort: SJABLOON_VOORSPELLINGEN,
          vrijeTekst,
        })
        return
      } catch (e) {
        console.error(`Voorspellingenmelding via WhatsApp mislukt voor ${speler.id}:`, e?.message || e)
      }
    }
    await stuurVoorspellingenMail(speler.email, {
      naam: speler.naam,
      wedstrijd,
      datum: fixture.datum || '',
      voorspellingen: Object.entries(predicties || {})
        .map(([playerId, p]) => ({
          playerId,
          naam: naamPerSpeler[playerId] || '???',
          score: p && Number.isInteger(p.home) && Number.isInteger(p.away) ? `${p.home}-${p.away}` : '—',
        }))
        .sort((a, b) => a.naam.localeCompare(b.naam)),
      playerId: speler.id,
    })
  }))

  const gelukt = resultaten.filter(r => r.status === 'fulfilled').length
  for (const r of resultaten) {
    if (r.status === 'rejected') console.error('Voorspellingenmelding mislukt:', r.reason)
  }

  await kvSet(sleutel, {
    handtekening,
    verstuurdOp: new Date().toISOString(),
    aantal: gelukt,
  })

  return { verstuurd: gelukt, van: ontvangers.length }
}

// ---------------------------------------------------------------------------
// Herinnering kort voor de aftrap
// ---------------------------------------------------------------------------
// Gaat alleen naar wie nog NIET heeft voorspeld. Wie al klaar is hoort niets:
// een herinnering voor iets wat je al gedaan hebt leest als ruis, en dan zet
// iemand de meldingen uit.
//
// De link wijst naar de wedstrijd zelf, met de opstelling al opengeklapt. In
// het sjabloon zit hij als knop onder het bericht, niet in de tekst — een URL
// in de tekst liet Meta het sjabloon herclassificeren van Utility naar
// Marketing (zie maakVoorspellingenTekst hierboven). Een knop mag wel.
const APP_URL = process.env.APP_BASE_URL || 'https://psv-predictor.vercel.app'

// Het achterstuk van de knop-URL. Meta staat in een sjabloonknop alleen een
// vast adres toe met één variabel stukje erachter, dus de wedstrijd zit in het
// pad en niet in een zoekparameter.
export function wedstrijdPad(matchId) {
  return `w/${String(matchId ?? '').trim()}`
}

export function wedstrijdLink(matchId) {
  return `${APP_URL}/${wedstrijdPad(matchId)}`
}

// De aftrap als "16:30", in Nederlandse tijd. De opgeslagen tijd is UTC, en
// een herinnering met het verkeerde uur erin is erger dan geen tijd.
export function aftrapTijd(datumISO) {
  const d = new Date(datumISO)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('nl-NL', {
    timeZone: 'Europe/Amsterdam',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Tekst voor zolang er nog geen goedgekeurd sjabloon is (en voor de e-mail).
// Hier mag de link wél gewoon in: vrije tekst wordt niet geclassificeerd.
export function maakHerinneringTekst(v, link = '') {
  const w = (v || []).map(x => String(x ?? '').trim())
  if (w.length < 2) return w.filter(Boolean).join('\n')
  return [
    `⏰ Over een half uur begint ${w[0]} (${w[1]}).`,
    '',
    'Jij hebt nog geen voorspelling ingevuld. Doe je het nog? Na de aftrap kan het niet meer.',
    link ? '' : null,
    link || null,
  ].filter(r => r !== null).join('\n')
}

export async function stuurHerinneringen(fixture) {
  if (!fixture?.matchId) return { verstuurd: 0, reden: 'geen wedstrijd' }

  // Eén herinnering per wedstrijd. De tikker die dit endpoint aanroept komt
  // binnen het tijdvenster meerdere keren langs; zonder dit slot zou iedereen
  // dan om de paar minuten hetzelfde bericht krijgen.
  const sleutel = `notificatie:herinnering:${fixture.matchId}`
  const vorige = await kvGet(sleutel)
  if (vorige?.verstuurdOp) return { verstuurd: 0, reden: 'al verstuurd' }

  const [spelers, index] = await Promise.all([
    alleGeverifieerdeSpelers(),
    kvGet(`predictionIndex:${fixture.matchId}`),
  ])
  const alVoorspeld = new Set(index || [])

  const ontvangers = spelers.filter(s => s.notificaties !== false && !alVoorspeld.has(s.id))
  if (ontvangers.length === 0) {
    // Ook dit vastleggen: iedereen was op tijd, dus er hoeft later niet
    // opnieuw gekeken te worden.
    await kvSet(sleutel, { verstuurdOp: new Date().toISOString(), aantal: 0 })
    return { verstuurd: 0, reden: 'iedereen heeft al voorspeld' }
  }

  const wedstrijd = `${zoekNaam(fixture.thuis)} – ${zoekNaam(fixture.uit)}`
  const tijd = aftrapTijd(fixture.datumISO)
  const link = wedstrijdLink(fixture.matchId)
  // Twee variabelen voor de tekst, de derde vult het achterstuk van de knop.
  // Dat is kaal het wedstrijdnummer: in het sjabloon staat het hele adres tot
  // en met /w/ vast, zodat er geen schuine streep in het variabele deel zit.
  const variabelen = [wedstrijd, tijd, String(fixture.matchId)]
  const vrijeTekst = maakHerinneringTekst([wedstrijd, tijd], link)

  const resultaten = await Promise.allSettled(ontvangers.map(async speler => {
    if (whatsappIngesteld() && speler.telefoon) {
      try {
        await stuurWhatsappSjabloon(speler.telefoon, variabelen, {
          soort: SJABLOON_HERINNERING,
          vrijeTekst,
        })
        return
      } catch (e) {
        console.error(`Herinnering via WhatsApp mislukt voor ${speler.id}:`, e?.message || e)
      }
    }
    await stuurHerinneringMail(speler.email, {
      naam: speler.naam,
      wedstrijd,
      tijd,
      link,
    })
  }))

  const gelukt = resultaten.filter(r => r.status === 'fulfilled').length
  for (const r of resultaten) {
    if (r.status === 'rejected') console.error('Herinnering mislukt:', r.reason)
  }

  await kvSet(sleutel, { verstuurdOp: new Date().toISOString(), aantal: gelukt })
  return { verstuurd: gelukt, van: ontvangers.length }
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
export async function stuurTestMelding(speler, { soort = SJABLOON_UITSLAG, fixture = null } = {}) {
  if (soort === SJABLOON_HERINNERING) return testHerinnering(speler, fixture)
  if (soort === SJABLOON_VOORSPELLINGEN) return testVoorspellingen(speler)

  const spelers = await alleGeverifieerdeSpelers()
  const naamPerSpeler = Object.fromEntries(spelers.map(s => [s.id, s.naam]))

  const echt = await haalLaatsteResultaat()
  const result = echt || voorbeeldResultaat(speler)
  if (!echt) naamPerSpeler.voorbeeld = 'Voorbeeldspeler'

  const gegevens = maakBerichtGegevens(result, speler, { naamPerSpeler })
  const info = await verstuurAan(speler, gegevens, result, naamPerSpeler)

  return {
    ...info,
    soort,
    gebaseerdOp: echt
      ? `${gegevens.wedstrijd} (${result.datum || 'laatste wedstrijd'})`
      : 'voorbeeldgegevens — er is nog geen uitslag verwerkt',
    echteData: Boolean(echt),
  }
}

// Eén proefbericht versturen. Geen terugval op e-mail als WhatsApp weigert:
// bij een proef wil je juist de foutmelding van Twilio zien. Alleen wanneer
// WhatsApp helemaal niet is ingesteld of er geen nummer bekend is, gaat het
// per mail — dan is dat immers ook het echte kanaal.
async function verstuurProef(speler, { soort, variabelen, vrijeTekst, mail }) {
  if (whatsappIngesteld() && speler.telefoon) {
    await stuurWhatsappSjabloon(speler.telefoon, variabelen, { soort, vrijeTekst })
    return { kanaal: 'whatsapp', naar: `+${speler.telefoon}` }
  }
  await mail()
  return { kanaal: 'email', naar: speler.email }
}

// Proef van de melding "iedereen heeft voorspeld", op de voorspellingen van de
// laatst verwerkte wedstrijd — net als de uitslagproef.
async function testVoorspellingen(speler) {
  const spelers = await alleGeverifieerdeSpelers()
  const naamPerSpeler = Object.fromEntries(spelers.map(s => [s.id, s.naam]))

  const echt = await haalLaatsteResultaat()
  const result = echt || voorbeeldResultaat(speler)
  if (!echt) naamPerSpeler.voorbeeld = 'Voorbeeldspeler'

  const wedstrijd = `${zoekNaam(result.thuis)} – ${zoekNaam(result.uit)}`
  const variabelen = [wedstrijd, maakAlleVoorspellingenRegel(result.predicties, naamPerSpeler)]

  const info = await verstuurProef(speler, {
    soort: SJABLOON_VOORSPELLINGEN,
    variabelen,
    vrijeTekst: maakVoorspellingenTekst(variabelen),
    mail: () => stuurVoorspellingenMail(speler.email, {
      naam: speler.naam,
      wedstrijd,
      datum: result.datum || '',
      voorspellingen: Object.entries(result.predicties || {})
        .map(([playerId, p]) => ({
          playerId,
          naam: naamPerSpeler[playerId] || '???',
          score: p && Number.isInteger(p.home) && Number.isInteger(p.away) ? `${p.home}-${p.away}` : '—',
        }))
        .sort((a, b) => a.naam.localeCompare(b.naam)),
      playerId: speler.id,
    }),
  })

  return {
    ...info,
    soort: SJABLOON_VOORSPELLINGEN,
    gebaseerdOp: echt
      ? `${wedstrijd} (${result.datum || 'laatste wedstrijd'})`
      : 'voorbeeldgegevens — er is nog geen uitslag verwerkt',
    echteData: Boolean(echt),
  }
}

// Proef van de herinnering, op de EERSTVOLGENDE wedstrijd — daar gaat zo'n
// bericht tenslotte over. De wedstrijd komt van de aanroeper; dit bestand mag
// _wedstrijden.js niet importeren, want dat importeert op zijn beurt dit.
async function testHerinnering(speler, fixture) {
  if (!fixture?.matchId) {
    throw new Error('Geen aanstaande wedstrijd gevonden om een herinnering over te sturen')
  }

  const wedstrijd = `${zoekNaam(fixture.thuis)} – ${zoekNaam(fixture.uit)}`
  const tijd = aftrapTijd(fixture.datumISO)
  const link = wedstrijdLink(fixture.matchId)
  const variabelen = [wedstrijd, tijd, String(fixture.matchId)]

  const info = await verstuurProef(speler, {
    soort: SJABLOON_HERINNERING,
    variabelen,
    vrijeTekst: maakHerinneringTekst([wedstrijd, tijd], link),
    mail: () => stuurHerinneringMail(speler.email, { naam: speler.naam, wedstrijd, tijd, link }),
  })

  return {
    ...info,
    soort: SJABLOON_HERINNERING,
    gebaseerdOp: `${wedstrijd}${fixture.datum ? ` (${fixture.datum}${tijd ? ` · ${tijd}` : ''})` : ''}`,
    echteData: true,
  }
}
