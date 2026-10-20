// Zet een ingevoerd telefoonnummer om naar het formaat dat WhatsApp verwacht:
// landcode + abonneenummer, zonder plus, spaties of streepjes (E.164-cijfers).
// Voorbeelden die allemaal '31612345678' opleveren:
//   06 12345678 · 06-12345678 · +31 6 12345678 · 0031612345678
//
// Een nummer dat met 0 begint wordt als Nederlands opgevat (landcode 31);
// wie een buitenlands nummer heeft, voert het met + of 00 in.
// Geeft null terug als er geen bruikbaar nummer van te maken is.
const STANDAARD_LANDCODE = '31'

export function normaliseerTelefoon(invoer) {
  if (!invoer) return null
  let s = String(invoer).replace(/[\s\-().]/g, '')
  if (s.startsWith('+')) s = s.slice(1)
  else if (s.startsWith('00')) s = s.slice(2)
  else if (s.startsWith('0')) s = STANDAARD_LANDCODE + s.slice(1)
  if (!/^\d{8,15}$/.test(s)) return null
  return s
}

// Leesbare weergave voor in de app, bijv. '+31612345678'.
export function toonTelefoon(genormaliseerd) {
  return genormaliseerd ? `+${genormaliseerd}` : ''
}
