// Standaard time-out voor aanroepen naar football-data.org. Zonder time-out
// wacht een serverless functie desnoods tientallen seconden op een externe API
// die traag is of blijft hangen — en wacht de gebruiker dus mee, met een
// eindeloos "Laden…" tot gevolg. Alle aanroepers hebben al een terugval op
// gecachete data; die wordt alleen nooit bereikt zolang de fetch blijft
// hangen. Met deze time-out valt de app na 8 seconden netjes terug op de
// (mogelijk iets oudere) cache in plaats van te blijven wachten.
const STANDAARD_TIMEOUT_MS = 8000

// Zelfde aanroep als een gewone fetch(), maar breekt af na `timeoutMs` en
// gooit dan een fout — die de aanroeper met zijn bestaande try/catch afvangt.
export async function fetchMetTimeout(url, opties = {}, timeoutMs = STANDAARD_TIMEOUT_MS) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...opties, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}
