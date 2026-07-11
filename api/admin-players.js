import { kvGet, kvSet } from './_kv.js'
import {
  alleSpelers, getPlayerById, isAdmin,
  hashPincode, verwijderUitEmailIndex, voegToeAanEmailIndex,
  isGeldigEmail,
} from './_players.js'
import { haalAlleWedstrijden, herberekenAlleTotalen } from './_wedstrijden.js'
import {
  stuurAccountVerwijderdMail, stuurNieuwePincodeDoorBeheerderMail,
  stuurEmailGewijzigdMail, stuurBeheerNotificaties,
} from './_email.js'
import { verifieerBeheerder, verifieerBeheerderSessie, getAdminEmails } from './_auth.js'

function genereerNieuwePincode() {
  return String(Math.floor(1000 + Math.random() * 9000))
}

// Verwijdert alle voorspellingen en punten van een speler, over alle
// wedstrijden (zowel al verwerkte resultaten als nog openstaande). Reads
// gebeuren parallel (verschillende, onafhankelijke keys) voor snelheid.
// De lopende totalen worden na afloop volledig herberekend (niet handmatig
// bijgewerkt) zodat de per-wedstrijd "totaal"-momentopnames van de OVERIGE
// spelers kloppend blijven.
async function verwijderAlleDataVanSpeler(playerId) {
  const resultsIndex = await kvGet('results:index') || []
  const results = await Promise.all(resultsIndex.map(matchId => kvGet(`result:${matchId}`)))

  const resultSchrijfActies = []
  for (let i = 0; i < resultsIndex.length; i++) {
    const matchId = resultsIndex[i]
    const result = results[i]
    if (!result) continue
    if (!(playerId in (result.punten || {}))) continue

    const nieuwePredicties = { ...result.predicties }
    const nieuweToto = { ...result.toto }
    const nieuwePunten = { ...result.punten }
    delete nieuwePredicties[playerId]
    delete nieuweToto[playerId]
    delete nieuwePunten[playerId]

    resultSchrijfActies.push(kvSet(`result:${matchId}`, {
      ...result,
      predicties: nieuwePredicties,
      toto: nieuweToto,
      punten: nieuwePunten,
    }))
  }
  await Promise.all(resultSchrijfActies)
  await herberekenAlleTotalen()

  const alleWedstrijden = await haalAlleWedstrijden()
  const voorspellingen = await Promise.all(
    alleWedstrijden.map(f => kvGet(`prediction:${f.matchId}:${playerId}`))
  )

  const predictieSchrijfActies = []
  for (let i = 0; i < alleWedstrijden.length; i++) {
    const f = alleWedstrijden[i]
    if (!voorspellingen[i]) continue

    predictieSchrijfActies.push(kvSet(`prediction:${f.matchId}:${playerId}`, null))
    predictieSchrijfActies.push(
      kvGet(`predictionIndex:${f.matchId}`).then(idx => {
        const nieuweIndex = (idx || []).filter(id => id !== playerId)
        return kvSet(`predictionIndex:${f.matchId}`, nieuweIndex)
      })
    )
  }
  await Promise.all(predictieSchrijfActies)
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method === 'GET') {
    const { sessionToken } = req.query
    const check = await verifieerBeheerderSessie(sessionToken)
    if (check.fout) return res.status(403).json({ error: check.fout })

    const spelers = await alleSpelers()
    const overzicht = spelers.map(s => ({
      id: s.id,
      naam: s.naam,
      email: s.email,
      geverifieerd: s.geverifieerd,
      aangemaaktOp: s.aangemaaktOp,
      isAdmin: isAdmin(s.email),
    }))

    return res.status(200).json({ spelers: overzicht })
  }

  if (req.method === 'POST') {
    let body = req.body
    if (typeof body === 'string') { try { body = JSON.parse(body) } catch (_) {} }
    const { action, sessionToken, adminPincode, playerId, nieuwEmail } = body || {}

    const check = await verifieerBeheerder(sessionToken, adminPincode)
    if (check.fout) return res.status(403).json({ error: check.fout })
    const beheerder = check.beheerder

    if (!playerId) return res.status(400).json({ error: 'playerId verplicht' })

    const doelSpeler = await getPlayerById(playerId)
    if (!doelSpeler) return res.status(404).json({ error: 'Speler niet gevonden' })

    const adminEmails = getAdminEmails()

    if (action === 'verwijderen') {
      await verwijderAlleDataVanSpeler(playerId)

      await kvSet(`player:${playerId}`, null)
      await kvSet(`playerByNaam:${doelSpeler.naam.toLowerCase()}`, null)
      await verwijderUitEmailIndex(doelSpeler.email, playerId)
      await kvSet(`loginPogingen:${playerId}`, null)

      const index = await kvGet('players:index') || []
      const nieuweIndex = index.filter(id => id !== playerId)
      await kvSet('players:index', nieuweIndex)

      await stuurBeheerNotificaties(
        [stuurAccountVerwijderdMail(doelSpeler.email, doelSpeler.naam)],
        adminEmails,
        'Speler verwijderd',
        `Beheerder ${beheerder.naam} (${beheerder.email}) heeft speler "${doelSpeler.naam}" (${doelSpeler.email}) verwijderd, inclusief al zijn voorspellingen en punten.`
      )

      return res.status(200).json({ success: true, message: `Speler ${doelSpeler.naam} en al zijn gegevens zijn verwijderd.` })
    }

    if (action === 'reset-pincode') {
      const nieuwePincode = genereerNieuwePincode()
      const pincodeHash = hashPincode(nieuwePincode)
      await kvSet(`player:${playerId}`, { ...doelSpeler, pincodeHash })

      // Een pincode-reset door de beheerder is een geldige, geverifieerde
      // route om weer toegang te krijgen — een eventuele inlog-blokkade
      // door te veel mislukte pogingen vervalt daarom meteen.
      await kvSet(`loginPogingen:${playerId}`, null)

      await stuurBeheerNotificaties(
        [stuurNieuwePincodeDoorBeheerderMail(doelSpeler.email, doelSpeler.naam, nieuwePincode)],
        adminEmails,
        'Pincode gereset',
        `Beheerder ${beheerder.naam} (${beheerder.email}) heeft de pincode van speler "${doelSpeler.naam}" (${doelSpeler.email}) gereset.`
      )

      return res.status(200).json({ success: true, message: `Nieuwe pincode is verstuurd naar ${doelSpeler.naam}.` })
    }

    if (action === 'wijzig-email') {
      if (!isGeldigEmail(nieuwEmail)) return res.status(400).json({ error: 'Ongeldig e-mailadres' })
      const nieuwEmailSchoon = nieuwEmail.toLowerCase().trim()
      const oudEmail = doelSpeler.email

      await verwijderUitEmailIndex(oudEmail, playerId)
      await voegToeAanEmailIndex(nieuwEmailSchoon, playerId)
      await kvSet(`player:${playerId}`, { ...doelSpeler, email: nieuwEmailSchoon })

      // Geen verificatielink nodig: de beheerder heeft de wijziging al
      // bevestigd met zijn eigen pincode. Wel bevestiging naar oud én
      // nieuw adres, net als bij e-mailwijziging door de speler zelf.
      await stuurBeheerNotificaties(
        [stuurEmailGewijzigdMail(oudEmail, nieuwEmailSchoon, doelSpeler.naam)],
        adminEmails,
        'E-mailadres gewijzigd',
        `Beheerder ${beheerder.naam} (${beheerder.email}) heeft het e-mailadres van speler "${doelSpeler.naam}" gewijzigd van ${oudEmail} naar ${nieuwEmailSchoon}.`
      )

      return res.status(200).json({ success: true, message: `E-mailadres van ${doelSpeler.naam} is gewijzigd.` })
    }

    return res.status(400).json({ error: 'Onbekende actie' })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
