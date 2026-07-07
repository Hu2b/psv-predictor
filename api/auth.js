import { kvGet, kvSet } from './_kv.js'
import {
  getPlayerByNaam, getPlayerByEmail, getPlayerById,
  maakSpeler, updatePlayer, telSpelers, isAdmin,
  hashPincode, verifyPincode, genereerToken,
  isGeldigeNaam, isGeldigEmail, isGeldigePincode,
} from './_players.js'
import { stuurVerificatieMail, stuurResetLinkMail, stuurPincodeGewijzigdMail } from './_email.js'

const MAX_SPELERS = 10
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000
const RESET_TTL_MS = 60 * 60 * 1000

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch (_) {} }
  const action = body?.action || req.query.action

  try {
    if (req.method === 'POST' && action === 'register') {
      const { email, emailHerhaal, naam, pincode, pincodeHerhaal } = body

      if (!isGeldigEmail(email)) return res.status(400).json({ error: 'Ongeldig e-mailadres' })
      if (email.toLowerCase().trim() !== (emailHerhaal || '').toLowerCase().trim()) {
        return res.status(400).json({ error: 'E-mailadressen komen niet overeen' })
      }
      if (!isGeldigeNaam(naam)) return res.status(400).json({ error: 'Naam moet 2 tot 20 tekens zijn' })
      if (!isGeldigePincode(pincode)) return res.status(400).json({ error: 'Pincode moet uit 4 cijfers bestaan' })
      if (pincode !== pincodeHerhaal) return res.status(400).json({ error: 'Pincodes komen niet overeen' })

      const bestaandNaam = await getPlayerByNaam(naam)
      if (bestaandNaam) return res.status(409).json({ error: 'Deze spelernaam is al in gebruik' })

      const bestaandEmail = await getPlayerByEmail(email)
      if (bestaandEmail) return res.status(409).json({ error: 'Dit e-mailadres is al geregistreerd' })

      const aantal = await telSpelers()
      if (aantal >= MAX_SPELERS) {
        return res.status(403).json({ error: `Het maximum van ${MAX_SPELERS} spelers is bereikt` })
      }

      const speler = await maakSpeler({ naam, email, pincode })

      const token = genereerToken()
      await kvSet(`verifyToken:${token}`, { playerId: speler.id, verlooptOp: Date.now() + VERIFY_TTL_MS })
      await stuurVerificatieMail(speler.email, speler.naam, token)

      return res.status(200).json({
        success: true,
        message: 'Account aangemaakt. Check je e-mail en klik op de link om te bevestigen.'
      })
    }

    if (req.method === 'POST' && action === 'verify') {
      const { token } = body
      if (!token) return res.status(400).json({ error: 'Token verplicht' })

      const data = await kvGet(`verifyToken:${token}`)
      if (!data) return res.status(400).json({ error: 'Ongeldige of al gebruikte link' })
      if (Date.now() > data.verlooptOp) return res.status(400).json({ error: 'Deze link is verlopen' })

      await updatePlayer(data.playerId, { geverifieerd: true })
      await kvSet(`verifyToken:${token}`, null)

      return res.status(200).json({ success: true, message: 'E-mailadres bevestigd. Je kunt nu inloggen.' })
    }

    if (req.method === 'POST' && action === 'login') {
      const { naam, pincode } = body
      if (!naam || !pincode) return res.status(400).json({ error: 'Naam en pincode zijn verplicht' })

      const speler = await getPlayerByNaam(naam)
      if (!speler || !verifyPincode(pincode, speler.pincodeHash)) {
        return res.status(401).json({ error: 'Onbekende speler of onjuiste pincode' })
      }
      if (!speler.geverifieerd) {
        return res.status(403).json({ error: 'Bevestig eerst je e-mailadres via de link die we je gestuurd hebben' })
      }

      const sessionToken = genereerToken()
      await kvSet(`session:${sessionToken}`, { playerId: speler.id, aangemaaktOp: Date.now() })

      return res.status(200).json({
        success: true,
        sessionToken,
        speler: { id: speler.id, naam: speler.naam, email: speler.email, isAdmin: isAdmin(speler.email) }
      })
    }

    if (req.method === 'GET' && action === 'sessie') {
      const { sessionToken } = req.query
      if (!sessionToken) return res.status(400).json({ error: 'sessionToken verplicht' })

      const sessie = await kvGet(`session:${sessionToken}`)
      if (!sessie) return res.status(401).json({ error: 'Sessie verlopen, log opnieuw in' })

      const speler = await getPlayerById(sessie.playerId)
      if (!speler) return res.status(401).json({ error: 'Speler niet gevonden' })

      return res.status(200).json({
        success: true,
        speler: { id: speler.id, naam: speler.naam, email: speler.email, isAdmin: isAdmin(speler.email) }
      })
    }

    if (req.method === 'POST' && action === 'uitloggen') {
      const { sessionToken } = body
      if (sessionToken) await kvSet(`session:${sessionToken}`, null)
      return res.status(200).json({ success: true })
    }

    if (req.method === 'POST' && action === 'vraag-reset-aan') {
      const { email } = body
      if (!isGeldigEmail(email)) return res.status(400).json({ error: 'Ongeldig e-mailadres' })

      const speler = await getPlayerByEmail(email)
      // Altijd dezelfde melding, ook als het e-mailadres niet bestaat —
      // zo lekt niet uit welke e-mailadressen wel/niet geregistreerd zijn.
      if (speler) {
        const token = genereerToken()
        await kvSet(`resetToken:${token}`, { playerId: speler.id, verlooptOp: Date.now() + RESET_TTL_MS })
        await stuurResetLinkMail(speler.email, speler.naam, token)
      }

      return res.status(200).json({
        success: true,
        message: 'Als dit e-mailadres bekend is, ontvang je een link om je pincode te wijzigen.'
      })
    }

    if (req.method === 'POST' && action === 'reset-pincode') {
      const { token, pincode, pincodeHerhaal } = body
      if (!token) return res.status(400).json({ error: 'Token verplicht' })
      if (!isGeldigePincode(pincode)) return res.status(400).json({ error: 'Pincode moet uit 4 cijfers bestaan' })
      if (pincode !== pincodeHerhaal) return res.status(400).json({ error: 'Pincodes komen niet overeen' })

      const data = await kvGet(`resetToken:${token}`)
      if (!data) return res.status(400).json({ error: 'Ongeldige of al gebruikte link' })
      if (Date.now() > data.verlooptOp) return res.status(400).json({ error: 'Deze link is verlopen' })

      const speler = await getPlayerById(data.playerId)
      if (!speler) return res.status(404).json({ error: 'Speler niet gevonden' })

      const pincodeHash = hashPincode(pincode)
      await updatePlayer(speler.id, { pincodeHash })
      await kvSet(`resetToken:${token}`, null)
      await stuurPincodeGewijzigdMail(speler.email, speler.naam)

      return res.status(200).json({ success: true, message: 'Pincode gewijzigd. Je kunt nu inloggen.' })
    }

    return res.status(400).json({ error: 'Onbekende actie' })
  } catch (err) {
    console.error('Auth handler error:', err)
    return res.status(500).json({ error: err.message })
  }
}
