import { kvGet, kvSet } from './_kv.js'
import {
  alleSpelers, getPlayerById, getPlayerByEmail, isAdmin,
  verifyPincode, hashPincode,
} from './_players.js'
import {
  stuurAccountVerwijderdMail, stuurNieuwePincodeDoorBeheerderMail,
  stuurBeheerderMeldingMail,
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
    const { action, sessionToken, adminPincode, playerId } = body || {}

    const check = await verifieerBeheerder(sessionToken, adminPincode)
    if (check.fout) return res.status(403).json({ error: check.fout })
    const beheerder = check.beheerder

    if (!playerId) return res.status(400).json({ error: 'playerId verplicht' })

    const doelSpeler = await getPlayerById(playerId)
    if (!doelSpeler) return res.status(404).json({ error: 'Speler niet gevonden' })

    if (action === 'verwijderen') {
      await kvSet(`player:${playerId}`, null)
      await kvSet(`playerByNaam:${doelSpeler.naam.toLowerCase()}`, null)
      await kvSet(`playerByEmail:${doelSpeler.email.toLowerCase()}`, null)

      const index = await kvGet('players:index') || []
      const nieuweIndex = index.filter(id => id !== playerId)
      await kvSet('players:index', nieuweIndex)

      await stuurAccountVerwijderdMail(doelSpeler.email, doelSpeler.naam)

      const adminEmails = getAdminEmails()
      for (const email of adminEmails) {
        await stuurBeheerderMeldingMail(
          email,
          'Speler verwijderd',
          `Beheerder ${beheerder.naam} (${beheerder.email}) heeft speler "${doelSpeler.naam}" (${doelSpeler.email}) verwijderd.`
        )
      }

      return res.status(200).json({ success: true, message: `Speler ${doelSpeler.naam} is verwijderd.` })
    }

    if (action === 'reset-pincode') {
      const nieuwePincode = genereerNieuwePincode()
      const pincodeHash = hashPincode(nieuwePincode)
      await kvSet(`player:${playerId}`, { ...doelSpeler, pincodeHash })

      await stuurNieuwePincodeDoorBeheerderMail(doelSpeler.email, doelSpeler.naam, nieuwePincode)

      const adminEmails = getAdminEmails()
      for (const email of adminEmails) {
        await stuurBeheerderMeldingMail(
          email,
          'Pincode gereset',
          `Beheerder ${beheerder.naam} (${beheerder.email}) heeft de pincode van speler "${doelSpeler.naam}" (${doelSpeler.email}) gereset.`
        )
      }

      return res.status(200).json({ success: true, message: `Nieuwe pincode is verstuurd naar ${doelSpeler.naam}.` })
    }

    return res.status(400).json({ error: 'Onbekende actie' })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
