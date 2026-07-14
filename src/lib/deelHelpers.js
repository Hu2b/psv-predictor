// Gedeelde helpers voor het genereren en delen van canvas-afbeeldingen.
// Bevat alle lessen die zijn geleerd bij het bouwbaar/betrouwbaar maken van
// de deel-functie op het Totaal-scherm — zodat een nieuwe deel-knop (zoals
// op het Wedstrijd-scherm) die problemen niet opnieuw hoeft tegen te komen:
//
// 1. iOS Safari hanteert een relatief lage grens aan hoe groot een canvas in
//    daadwerkelijke pixels mag zijn (in tegenstelling tot desktop-browsers).
//    Een te hoge resolutie bij een lange afbeelding laat canvas.toBlob()
//    stilletjes falen. -> berekenAdaptieveDpr()
// 2. navigator.share() moet vrijwel synchroon binnen de tik-actie van de
//    gebruiker aangeroepen worden, anders faalt het stilzwijgend op iOS
//    Safari. -> de afbeelding moet dus vooraf al klaarstaan (zie
//    gebruikende component), handleDelen zelf mag niet meer hoeven wachten.
// 3. window.open() met een nieuw tabblad wordt door mobiele Safari vaak
//    stilzwijgend geblokkeerd. -> altijd window.location.href gebruiken.
// 4. Als navigator.share() met bestanden niet lukt, de afbeelding zelf tonen
//    (i.p.v. alleen tekst) zodat de gebruiker 'm handmatig kan opslaan en
//    delen — de afbeelding zelf mag nooit verloren gaan.

// Leest een CSS custom property op (bijv. --psv-red), zodat een canvas-
// tekening automatisch hetzelfde kleurenschema volgt als de rest van de app.
export function cssVar(naam, fallback) {
  const waarde = getComputedStyle(document.documentElement).getPropertyValue(naam).trim()
  return waarde || fallback
}

// Handmatige afgeronde rechthoek i.p.v. ctx.roundRect(), voor bredere
// browserondersteuning (ook oudere WebViews die apps soms gebruiken om
// share-doelwitten te openen).
export function tekenAfgerondeRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.arcTo(x + w, y, x + w, y + radius, radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius)
  ctx.lineTo(x + radius, y + h)
  ctx.arcTo(x, y + h, x, y + h - radius, radius)
  ctx.lineTo(x, y + radius)
  ctx.arcTo(x, y, x + radius, y, radius)
  ctx.closePath()
}

// Tekent tekst zo dat de daadwerkelijk zichtbare pixels (de "inkt") rechts
// uitlijnen op rechterRand — in plaats van ctx.textAlign = 'right', dat
// uitlijnt op de rekenkundige tekenbreedte (advance width). Cijfers als "0"
// en "1" hebben van nature verschillend wit-ruimte aan hun rechterzijde in
// de meeste lettertypen, waardoor bijv. "2–1" en "2–0" met textAlign='right'
// zichtbaar net niet even ver uitlijnen, ook al is de rekenkundige breedte
// identiek. Deze functie meet de werkelijke inkt-rand (actualBoundingBoxRight)
// en compenseert daarvoor, zodat cijfers en tekst altijd pixel-precies
// uitlijnen.
export function fillTextRechtsUitgelijnd(ctx, tekst, rechterRand, y) {
  const metrics = ctx.measureText(tekst)
  const inktRand = metrics.actualBoundingBoxRight ?? metrics.width
  ctx.textAlign = 'left'
  ctx.fillText(tekst, rechterRand - inktRand, y)
}

// Veilige bovengrens (in pixels) voor een canvas-dimensie, ruim onder de
// grens waar mobiele browsers (met name iOS Safari) op vastlopen.
export const VEILIGE_MAX_AFMETING = 4096

// Bepaalt de hoogst mogelijke dpr (resolutie-factor) die de canvas-
// afmetingen (breedte/hoogte, in logische pixels) nog binnen de veilige
// grens houdt, met streefDpr als bovengrens voor korte/normale afbeeldingen.
export function berekenAdaptieveDpr(breedte, hoogte, streefDpr = 5) {
  let dpr = streefDpr
  if (hoogte * dpr > VEILIGE_MAX_AFMETING) dpr = Math.max(1, Math.floor(VEILIGE_MAX_AFMETING / hoogte))
  if (breedte * dpr > VEILIGE_MAX_AFMETING) dpr = Math.max(1, Math.min(dpr, Math.floor(VEILIGE_MAX_AFMETING / breedte)))
  return dpr
}

// Deelt een afbeelding (Blob) via de Web Share API, met een gelaagde
// terugval als dat niet lukt:
//   1. navigator.share() met het bestand (beste ervaring, opent het native
//      deelvenster met de afbeelding al klaar).
//   2. Als dat niet kan/mag/faalt (behalve als de gebruiker zelf annuleert):
//      de afbeelding zelf openen (navigatie, geen pop-up) zodat de
//      gebruiker 'm met een lange druk kan opslaan en handmatig delen.
//   3. Als er zelfs geen blob is (bijv. canvas-opbouw mislukt): terugvallen
//      op een meegegeven tekst-URL (bijv. een wa.me-link), indien opgegeven.
export async function deelOfValTerug({ blob, bestandsnaam, titel, tekst, tekstFallbackUrl }) {
  if (!blob) {
    if (tekstFallbackUrl) window.location.href = tekstFallbackUrl
    return
  }

  const bestand = new File([blob], bestandsnaam, { type: 'image/png' })
  const kanBestandenDelen = typeof navigator.canShare === 'function'
    && typeof navigator.share === 'function'
    && navigator.canShare({ files: [bestand] })

  if (kanBestandenDelen) {
    try {
      await navigator.share({ files: [bestand], title: titel, text: tekst })
      return
    } catch (e) {
      // AbortError = gebruiker heeft de deel-dialoog zelf geannuleerd — dan
      // niet alsnog een terugval tonen, dat voelt als een bug.
      if (e && e.name === 'AbortError') return
      // Andere fout (bijv. het stilzwijgend falen dat op sommige iPhones
      // gebeurt): val door naar de afbeelding-terugval hieronder.
    }
  }

  const url = URL.createObjectURL(blob)
  window.location.href = url
}
