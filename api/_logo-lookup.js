import { kvGet, kvSet } from './_kv.js'
import { TEAMS } from '../shared/teams.js'

// Slaat het logo van een team permanent op, maar alleen de EERSTE keer.
// Wordt aangeroepen met logo's die al geverifieerd zijn (afkomstig van
// football-data.org bij automatisch opgehaalde wedstrijden).
export async function bewaarLogoAlsNieuw(teamCode, logoUrl) {
  if (!teamCode || !logoUrl) return
  const cacheKey = `logo:${teamCode}`
  const bestaand = await kvGet(cacheKey)
  if (bestaand) return // al eerder opgeslagen, nooit overschrijven
  await kvSet(cacheKey, logoUrl)
}

// Haalt het opgeslagen logo op voor een team. Valt terug op de statische
// lijst als er nog nooit een automatische wedstrijd met dit team is gezien.
// Geeft null terug als er niets bekend is; de frontend toont dan een
// transparant vlak van dezelfde afmeting (geen kapot plaatje, geen sprong
// in de layout).
export async function zoekLogo(teamCode) {
  const opgeslagen = await kvGet(`logo:${teamCode}`)
  if (opgeslagen) return opgeslagen
  return TEAMS[teamCode]?.logo || null
}
