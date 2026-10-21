import { fetchMetTimeout } from './_fetch.js'

// Verzendt berichten via het WhatsApp Business Platform (Meta Cloud API).
//
// Belangrijk om te weten bij het instellen:
// - Een bericht dat WIJ beginnen (zoals een uitslagmelding) moet een vooraf
//   door Meta GOEDGEKEURD sjabloon gebruiken; vrije tekst mag alleen binnen
//   24 uur nadat de ontvanger zelf iets stuurde.
// - Het gekoppelde telefoonnummer mag niet al in gebruik zijn voor gewone
//   WhatsApp of de WhatsApp Business-app.
// - Ontvangers moeten opt-in hebben gegeven (in deze app: zelf hun nummer
//   invullen en meldingen aanzetten).
//
// Benodigde omgevingsvariabelen:
//   WHATSAPP_TOKEN            - permanent access token van de Meta-app
//   WHATSAPP_PHONE_NUMBER_ID  - id van het gekoppelde WhatsApp-nummer
//   WHATSAPP_TEMPLATE         - naam van het goedgekeurde sjabloon
//   WHATSAPP_TEMPLATE_TAAL    - taalcode van het sjabloon (standaard nl)
const TOKEN = process.env.WHATSAPP_TOKEN
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID
const TEMPLATE = process.env.WHATSAPP_TEMPLATE || 'psv_poule_uitslag'
const TEMPLATE_TAAL = process.env.WHATSAPP_TEMPLATE_TAAL || 'nl'
const API_VERSIE = 'v21.0'

// Alleen als beide gezet zijn kan er daadwerkelijk via WhatsApp verstuurd
// worden; anders valt het notificatiesysteem terug op e-mail.
export function whatsappIngesteld() {
  return Boolean(TOKEN && PHONE_NUMBER_ID)
}

// Toont de instellingen zonder geheimen prijs te geven: alleen of iets gezet
// is, plus de (niet-geheime) sjabloonnaam en taal. Zo kan de beheerder in de
// app zien wat er nog ontbreekt zonder het token te tonen.
export function whatsappInstellingen() {
  return {
    ingesteld: whatsappIngesteld(),
    tokenAanwezig: Boolean(TOKEN),
    phoneNumberIdAanwezig: Boolean(PHONE_NUMBER_ID),
    sjabloon: TEMPLATE,
    taal: TEMPLATE_TAAL,
  }
}

// Meta weigert een sjabloonvariabele die een regeleinde, een tab of vier of
// meer spaties achter elkaar bevat — het bericht gaat dan niet weg en je ziet
// alleen een foutcode terug. Alles wordt daarom platgeslagen tot één regel.
// De lengtegrens per variabele is 1024 tekens; we kappen ruim daarvoor af.
const MAX_VARIABELE_LENGTE = 900

function maakVariabeleVeilig(waarde) {
  const plat = String(waarde ?? '').replace(/\s+/g, ' ').trim()
  return plat.length > MAX_VARIABELE_LENGTE
    ? `${plat.slice(0, MAX_VARIABELE_LENGTE - 1)}…`
    : plat
}

// Verstuurt het sjabloon naar één nummer. `variabelen` is een lijst strings
// die in volgorde de {{1}}, {{2}}, … in het sjabloon invult.
// Gooit een fout als het versturen mislukt, zodat de aanroeper per ontvanger
// kan loggen zonder dat de rest van de verzending stukloopt.
export async function stuurWhatsappSjabloon(naarNummer, variabelen) {
  if (!whatsappIngesteld()) throw new Error('WhatsApp is niet ingesteld')
  if (!naarNummer) throw new Error('Geen telefoonnummer')

  const res = await fetchMetTimeout(
    `https://graph.facebook.com/${API_VERSIE}/${PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: naarNummer,
        type: 'template',
        template: {
          name: TEMPLATE,
          language: { code: TEMPLATE_TAAL },
          components: [{
            type: 'body',
            parameters: variabelen.map(v => ({ type: 'text', text: maakVariabeleVeilig(v) })),
          }],
        },
      }),
    }
  )

  if (!res.ok) {
    const tekst = await res.text().catch(() => '')
    throw new Error(`WhatsApp gaf status ${res.status}: ${tekst.slice(0, 300)}`)
  }
  return await res.json().catch(() => ({}))
}
