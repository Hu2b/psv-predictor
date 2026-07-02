import { kvSet } from './_kv.js'

// Eenmalig opruimscript: verwijdert de foutieve 'logo:AZ' sleutel (zonder
// spatie) die ontstond doordat AZ eerder inconsistent werd opgeslagen —
// soms als 'AZ' (handmatig ingevoerd), soms als 'AZ ' (met spatie, uit de
// oude teams.js). Na de fix in shared/teams.js is 'AZ' de enige juiste vorm.
export default async function handler(req, res) {
  await kvSet('logo:AZ', null)

  return res.status(200).json({
    success: true,
    message: "logo:AZ is gewist. De volgende keer dat AZ voorbijkomt (automatisch of handmatig) wordt het juiste logo opnieuw opgeslagen."
  })
}
