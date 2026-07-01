import { kvSet } from './_kv.js'

// Eenmalig opruimscript: verwijdert de foutief opgeslagen logo's (FC Köln
// i.p.v. PSV/AZ) die zijn ontstaan door de vroegere, onbetrouwbare
// football-data.org naam-zoekfunctie. Na gebruik mag dit bestand weer weg.
export default async function handler(req, res) {
  await kvSet('logo:PSV', null)
  await kvSet('logo:AZ ', null) // let op: 'AZ ' met spatie, zoals in shared/teams.js

  return res.status(200).json({
    success: true,
    message: 'logo:PSV en logo:AZ zijn gewist. De volgende automatisch opgehaalde PSV/AZ-wedstrijd zal het juiste logo opnieuw opslaan.'
  })
}
