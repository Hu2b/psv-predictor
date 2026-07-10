import { kvGet, kvSet } from './_kv.js'
import {
  alleSpelers, getPlayerById, isAdmin,
  verifyPincode, hashPincode, verwijderUitEmailIndex, voegToeAanEmailIndex,
  isGeldigEmail,
} from './_players.js'
import { haalAlleWedstrijden } from './_wedstrijden.js'
import {
  stuurAccountVerwijderdMail, stuurNieuwePincodeDoorBeheerderMail,
  stuurBeheerderMeldingMail, stuurEmailGewijzigdMail,
} from './_email.js'

function genereerNieuwePincode() {
  return String(Math.floor(1000 + Math.random() * 9000))
}

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
}

async function verifieerBeheerder(sessionToken, adminPincode) {
  if (!sessionToken || !adminPincode) return { fout: 'sessionToken en pincode zijn verplicht' }

  const sessie = await kvGet(`session:${sessionToken}`)
  if (!sessie) return { fout: 'Sessie verlopen, log opnieuw in' }

  const beheerder = await getPlayerById(sessie.playerId)
  if (!beheerder) return { fout: 'Speler niet gevonden' }
  if (!isAdmin(beheerder.email)) return { fout: 'Geen beheerrechten' }
  if (!verifyPincode(adminPincode, beheerder.pincodeHash)) return { fout: 'Onjuiste pincode' }

  return { beheerder }
}

// Verwijdert alle voorspellingen en punten van een speler, over alle
// wedstrijden (zowel al verwerkte resultaten als nog openstaande).
async function verwijderAlleDataVanSpeler(playerId) {
  const resultsIndex = await kvGet('results:index') || []
  const totals = await kvGet('totals') || {}
  const nieuweTotals = { ...totals }

  for (const matchId of resultsIndex) {
    const result = await kvGet(`result:${matchId}`)
    if (!result) continue
    if (!(playerId in (result.punten || {}))) continue

    const oud = result.punten[playerId] || 0
    nieuweTotals[playerId] = (nieuweTotals[playerId] || 0) - oud

    const nieuwePredicties = { ...result.predicties }
    const nieuweToto = { ...result.toto }
    const nieuwePunten = { ...result.punten }
    const nieuweTotalen = { ...result.totalen }
    delete nieuwePredicties[playerId]
    delete nieuweToto[playerId]
    delete nieuwePunten[playerId]
    delete nieuweTotalen[playerId]

    await kvSet(`result:${matchId}`, {
      ...result,
      predicties: nieuwePredicties,
      toto: nieuweToto,
      punten: nieuwePunten,
      totalen: nieuweTotalen,
    })
  }
  delete nieuweTotals[playerId]
  await kvSet('totals', nieuweTotals)

  const alleWedstrijden = await haalAlleWedstrijden()
  for (const f of alleWedstrijden) {
    const bestaandeVoorspelling = await kvGet(`prediction:${f.matchId}:${playerId}`)
    if (!bestaandeVoorspelling) continue

    await kvSet(`prediction:${f.matchId}:${playerId}`, null)
    const predictionIndex = await kvGet(`predictionIndex:${f.matchId}`) || []
    const nieuweIndex = predictionIndex.filter(id => id !== playerId)
    await kvSet(`predictionIndex:${f.matchId}`, nieuweIndex)
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method === 'GET') {
    const { sessionToken } = req.query
    if (!sessionToken) return res.status(400).json({ error: 'sessionToken verplicht' })

    const sessie = await kvGet(`session:${sessionToken}`)
    if (!sessie) return res.status(401).json({ error: 'Sessie verlopen, log opnieuw in' })

    const beheerder = await getPlayerById(sessie.playerId)
    if (!beheerder || !isAdmin(beheerder.email)) {
      return res.status(403).json({ error: 'Geen beheerrechten' })
    }

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

    if (action === 'verwijderen') {
      await verwijderAlleDataVanSpeler(playerId)

      await kvSet(`player:${playerId}`, null)
      await kvSet(`playerByNaam:${doelSpeler.naam.toLowerCase()}`, null)
      await verwijderUitEmailIndex(doelSpeler.email, playerId)

      const index = await kvGet('players:index') || []
      const nieuweIndex = index.filter(id => id !== playerId)
      await kvSet('players:index', nieuweIndex)

      await stuurAccountVerwijderdMail(doelSpeler.email, doelSpeler.naam)

      const adminEmails = getAdminEmails()
      for (const email of adminEmails) {
        await stuurBeheerderMeldingMail(
          email,
          'Speler verwijderd',
          `Beheerder ${beheerder.naam} (${beheerder.email}) heeft speler "${doelSpeler.naam}" (${doelSpeler.email}) verwijderd, inclusief al zijn voorspellingen en punten.`
        )
      }

      return res.status(200).json({ success: true, message: `Speler ${doelSpeler.naam} en al zijn gegevens zijn verwijderd.` })
    }

    if (action === 'reset-pincode') {
      const nieuwePincode = genereerNieuwePincode()
      const
