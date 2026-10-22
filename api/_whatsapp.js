import { fetchMetTimeout } from './_fetch.js'

// Verzendt WhatsApp-berichten via Twilio.
//
// Waarom via Twilio en niet rechtstreeks via Meta: om zelf een WhatsApp
// Business Account aan te maken moet je bedrijfsportfolio door Meta's
// beleidscontrole komen. Voor een particulier zonder ingeschreven bedrijf
// loopt dat vast (foutcode 2494070). Twilio is een door Meta erkende Business
// Solution Provider: hun account is al geverifieerd, dus zij regelen die kant
// en wij praten alleen met Twilio.
//
// Belangrijk om te weten bij het instellen:
// - Een bericht dat WIJ beginnen (zoals een uitslagmelding) moet een vooraf
//   goedgekeurd sjabloon gebruiken. Bij Twilio heet dat een Content Template
//   en spreek je het aan met zijn ContentSid (begint met HX).
// - Het gekoppelde telefoonnummer mag niet al in gebruik zijn voor gewone
//   WhatsApp of de WhatsApp Business-app.
// - Ontvangers moeten opt-in hebben gegeven (in deze app: zelf hun nummer
//   invullen en meldingen aanzetten).
//
// Benodigde omgevingsvariabelen:
//   TWILIO_ACCOUNT_SID    - Account SID uit de Twilio Console (begint met AC)
//   TWILIO_AUTH_TOKEN     - Auth Token uit de Twilio Console
//   TWILIO_WHATSAPP_FROM  - de WhatsApp-afzender, bijv. +14155238886
//   TWILIO_CONTENT_SID    - SID van het goedgekeurde sjabloon (begint met HX)
const TWILIO_API = 'https://api.twilio.com/2010-04-01'

// De omgevingsvariabelen worden bij elke aanroep opnieuw gelezen in plaats van
// één keer bij het laden van de module. Dat scheelt niets in productie, maar
// maakt de boel wél testbaar zonder de module opnieuw te hoeven importeren.
function instellingen() {
  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    afzender: process.env.TWILIO_WHATSAPP_FROM || '',
    sjabloonUitslag: process.env.TWILIO_CONTENT_SID || '',
    sjabloonVoorspellingen: process.env.TWILIO_CONTENT_SID_VOORSPELLINGEN || '',
  }
}

// De app kent twee soorten berichten, elk met een eigen goedgekeurd sjabloon.
// Ze staan los van elkaar: je kunt het ene al in gebruik hebben terwijl het
// andere nog in beoordeling is.
export const SJABLOON_UITSLAG = 'uitslag'
export const SJABLOON_VOORSPELLINGEN = 'voorspellingen'

export function sjabloonSid(soort) {
  const i = instellingen()
  return soort === SJABLOON_VOORSPELLINGEN ? i.sjabloonVoorspellingen : i.sjabloonUitslag
}

// Zonder account, token én afzender kan er niets verstuurd worden; dan valt
// het notificatiesysteem terug op e-mail.
//
// TWILIO_CONTENT_SID is bewust NIET verplicht. Met sjabloon verstuurt de app
// op elk moment; zonder sjabloon stuurt hij vrije tekst, en die mag WhatsApp
// alleen afleveren binnen 24 uur nadat de ontvanger zelf iets stuurde. Dat is
// precies wat de Twilio-sandbox toestaat, en daarmee kun je de hele keten
// testen voordat er een goedgekeurd sjabloon is. Welke van de twee actief is,
// staat in whatsappInstellingen().modus — zodat niemand per ongeluk denkt dat
// er sjablonen gaan en zich verbaast over berichten die niet aankomen.
export function whatsappIngesteld() {
  const i = instellingen()
  return Boolean(i.accountSid && i.authToken && i.afzender)
}

// Twilio verwacht adressen in de vorm 'whatsapp:+31612345678'. Onze eigen
// nummers staan opgeslagen als kale cijfers ('31612345678'), en wat een
// beheerder in een omgevingsvariabele zet kan er van alles tussen hebben
// staan — plus, spaties, streepjes. Alles wordt hier naar één vorm gebracht.
export function naarWhatsappAdres(nummer) {
  const cijfers = String(nummer ?? '').replace(/\D/g, '')
  return cijfers ? `whatsapp:+${cijfers}` : ''
}

// Toont de instellingen zonder geheimen prijs te geven: alleen of iets gezet
// is, plus de (niet-geheime) afzender en sjabloon-SID. Zo kan de beheerder in
// de app zien wat er nog ontbreekt zonder dat het Auth Token in beeld komt.
export function whatsappInstellingen() {
  const i = instellingen()
  return {
    ingesteld: whatsappIngesteld(),
    aanbieder: 'twilio',
    modus: i.sjabloonUitslag ? 'sjabloon' : 'vrije tekst',
    accountAanwezig: Boolean(i.accountSid),
    tokenAanwezig: Boolean(i.authToken),
    afzenderAanwezig: Boolean(i.afzender),
    sjabloonAanwezig: Boolean(i.sjabloonUitslag),
    afzender: i.afzender ? naarWhatsappAdres(i.afzender).replace('whatsapp:', '') : '',
    sjabloon: i.sjabloonUitslag,
    sjabloonVoorspellingenAanwezig: Boolean(i.sjabloonVoorspellingen),
    sjabloonVoorspellingen: i.sjabloonVoorspellingen,
  }
}

// WhatsApp weigert een sjabloonvariabele die een regeleinde, een tab of vier
// of meer spaties achter elkaar bevat — het bericht gaat dan niet weg en je
// ziet alleen een foutcode terug. Alles wordt daarom platgeslagen tot één
// regel. De lengtegrens per variabele is 1024 tekens; we kappen ruim daarvoor
// af.
const MAX_VARIABELE_LENGTE = 900

export function maakVariabeleVeilig(waarde) {
  const plat = String(waarde ?? '').replace(/\s+/g, ' ').trim()
  return plat.length > MAX_VARIABELE_LENGTE
    ? `${plat.slice(0, MAX_VARIABELE_LENGTE - 1)}…`
    : plat
}

// Twilio verwacht de sjabloonvariabelen als JSON met genummerde sleutels:
// {"1":"PSV – Ajax","2":"2-1"}. De volgorde van de lijst bepaalt het nummer.
export function maakContentVariables(variabelen) {
  const paren = (variabelen || []).map((v, i) => [String(i + 1), maakVariabeleVeilig(v)])
  return JSON.stringify(Object.fromEntries(paren))
}

// Twilio antwoordt bij een fout met JSON waarin 'message' en 'code' staan.
// Die willen we onverkort doorgeven aan de beheerder, want daar staat precies
// in wat er mis is — een niet-goedgekeurd sjabloon, een ontvanger die zich
// nooit heeft aangemeld, een verkeerde afzender.
function beknopteFout(tekst) {
  try {
    const j = JSON.parse(tekst)
    if (j?.message) return j.code ? `${j.message} (code ${j.code})` : j.message
  } catch (_) {}
  return tekst.slice(0, 300)
}

// Verstuurt één bericht naar één nummer.
//
// `variabelen` is een lijst strings die in volgorde de {{1}}, {{2}}, … in het
// sjabloon invult. `soort` kiest wélk sjabloon: de uitslagmelding of de
// voorspellingenmelding. `vrijeTekst` is de tekst die gebruikt wordt zolang
// dat sjabloon nog geen goedgekeurde SID heeft — WhatsApp levert die alleen af
// binnen 24 uur nadat de ontvanger zelf iets stuurde, maar het maakt de keten
// testbaar voordat de goedkeuring rond is.
//
// Gooit een fout als het versturen mislukt, zodat de aanroeper per ontvanger
// kan loggen zonder dat de rest van de verzending stukloopt.
export async function stuurWhatsappSjabloon(naarNummer, variabelen, { soort = SJABLOON_UITSLAG, vrijeTekst = '' } = {}) {
  if (!whatsappIngesteld()) throw new Error('WhatsApp is niet ingesteld')

  const naar = naarWhatsappAdres(naarNummer)
  if (!naar) throw new Error('Geen telefoonnummer')

  const sjabloon = sjabloonSid(soort)
  const body = new URLSearchParams({
    From: naarWhatsappAdres(instellingen().afzender),
    To: naar,
    ...(sjabloon
      ? { ContentSid: sjabloon, ContentVariables: maakContentVariables(variabelen) }
      : { Body: vrijeTekst || variabelen.filter(Boolean).join('\n') }),
  })

  const i = instellingen()
  const res = await fetchMetTimeout(
    `${TWILIO_API}/Accounts/${encodeURIComponent(i.accountSid)}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${i.accountSid}:${i.authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    }
  )

  if (!res.ok) {
    const tekst = await res.text().catch(() => '')
    throw new Error(`Twilio gaf status ${res.status}: ${beknopteFout(tekst)}`)
  }
  return await res.json().catch(() => ({}))
}
