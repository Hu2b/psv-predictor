import { kvGet, kvSet } from './_kv.js'
import { TEAMS } from '../shared/teams.js'

const API_KEY = process.env.FOOTBALL_DATA_KEY
const API_BASE = 'https://api.football-data.org/v4'

export async function zoekLogoVoorTeam(teamNaam, teamCode) {
  const cacheKey = `logo:${teamCode}`

  // 1. Al eerder opgezocht en permanent opgeslagen?
  const cached = await kvGet(cacheKey)
  if (cached) return cached

  // 2. Geverifieerde crest ophalen via football-data.org's teamzoekfunctie
  if (API_KEY && teamNaam) {
    try {
      const res = await fetch(`${API_BASE}/teams?name=${encodeURIComponent(teamNaam)}`, {
        headers: { 'X-Auth-Token': API_KEY }
      })
      const data = await res.json()
      const match = data.teams?.[0]
      if (match?.crest) {
        await kvSet(cacheKey, match.crest)
        return match.crest
      }
    } catch (e) {
      console.error('Logo-opzoeken via football-data.org mislukt:', e)
    }
  }

  // 3. Laatste redmiddel: statische fallback-lijst uit shared/teams.js
  const fallback = TEAMS[teamCode]?.logo || null
  if (fallback) await kvSet(cacheKey, fallback)
  return fallback
}
