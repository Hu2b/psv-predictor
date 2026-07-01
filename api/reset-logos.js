import { kvSet } from './_kv.js'
import { TEAMS } from '../shared/teams.js'
import { SEASON } from './_wedstrijden.js'

function getNLDatumKey() {
  const nu = new Date()
  return nu.toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit' })
}

export default async function handler(req, res) {
  const gewist = []

  // 1. Alle team-logo's wissen (ook de verkeerd opgeslagen Köln-links)
  for (const code of Object.keys(TEAMS)) {
    await kvSet(`logo:${code}`, null)
    gewist.push(`logo:${code}`)
  }

  // 2. Fixtures-cache wissen: fallback + alle tijdvensters van vandaag
  const fallbackKey = `psv:fixtures:fd:${SEASON}:latest`
  await kvSet(fallbackKey, null)
  gewist.push(fallbackKey)

  const datumKey = getNLDatumKey()
  for (const venster of [1, 2, 3]) {
    const cacheKey = `psv:fixtures:fd:${SEASON}:${datumKey}:v${venster}`
    await kvSet(cacheKey, null)
    gewist.push(cacheKey)
  }

  return res.status(200).json({
    success: true,
    message: `${gewist.length} cache-sleutels gewist. Open de app opnieuw om alles vers op te bouwen.`,
    gewist
  })
}
