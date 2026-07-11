import { kvGet, kvSet } from './_kv.js'
import {
  getPlayerByNaam, getSpelersByEmail, getPlayerById,
  maakSpeler, updatePlayer, telSpelers, isAdmin,
  hashPincode, verifyPincode, genereerToken,
  isGeldigeNaam, isGeldigEmail, isGeldigePincode,
  voegToeAanEmailIndex, verwijderUitEmailIndex,
} from './_players.js'
import {
  stuurVerificatieMail, stuurResetLinkMail, stuurPincodeGewijzigdMail,
  stuurEmailWijzigingVerificatieMail, stuurEmailGewijzigdMail,
} from './_email.js'

const MAX_SPELERS = 10
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000
const RESET_TTL_MS = 60 * 60 * 1000
const MAX_LOGIN_POGINGEN = 5
const LOCKOUT_MS = 15 * 60 * 1000

async function haalSpelerViaSessie(sessionToken) {
  if (!sessionToken) return { fout: 'sessionToken verplicht' }
  const sessie = await kvGet(`session:${sessionToken}`)
  if (!sessie) return { fout: 'Sessie verlopen, log opnieuw in' }
  const speler = await getPlayerById(sessie.playerId)
  if (!speler) return { fout: 'Speler niet gevonden' }
  return { speler }
}

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
      if (!speler) {
        return res.status(401).json({ error: 'Onbekende speler of onjuiste pincode' })
      }

      const pogingenKey = `loginPogingen:${speler.id}`
      const pogingen = await kvGet(pogingenKey)
      if (pogingen?.geblokkeerdTot && Date.now() < pogingen.geblokkeerdTot) {
        const resterendeMinuten = Math.ceil((pogingen.geblokkeerdTot - Date.now()) / 60000)
        return res.status(429).json({
          error: `Te veel mislukte pogingen. Probeer het over ${resterendeMinuten} ${resterendeMinuten === 1 ? 'minuut' : 'minuten'} opnieuw.`
        })
      }

      if (!verifyPincode(pincode, speler.pincodeHash)) {
        const aantal = (pogingen?.geblokkeerdTot ? 0 : (pogingen?.aantal || 0)) + 1
        if (aantal >= MAX_LOGIN_POGINGEN) {
          await kvSet(pogingenKey, { aantal, geblokkeerdTot: Date.now() + LOCKOUT_MS })
          return res.status(429).json({
            error: `Te veel mislukte pogingen. Probeer het over 15 minuten opnieuw.`
          })
        }
        await kvSet(pogingenKey, { aantal })
        return res.status(401).json({ error: 'Onbekende speler of onjuiste pincode' })
      }

      // Geslaagde login: eventuele opgebouwde pogingen/blokkade vervalt.
      if (pogingen) await kvSet(pogingenKey, null)

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

    // "Pincode vergeten": omdat e-mail niet meer uniek is, is naam + e-mail
    // samen nodig om de juiste speler te vinden.
    if (req.method === 'POST' && action === 'vraag-reset-aan') {
      const { naam, email } = body
      if (!naam || !isGeldigEmail(email)) {
        return res.status(400).json({ error: 'Naam en e-mailadres zijn verplicht' })
      }

      const speler = await getPlayerByNaam(naam)
      // Altijd dezelfde melding, ook als de combinatie niet bestaat — zo lekt
      // niet uit welke naam/e-mailcombinaties wel/niet geregistreerd zijn.
      if (speler && speler.email.toLowerCase() === email.toLowerCase().trim()) {
        const token = genereerToken()
        await kvSet(`resetToken:${token}`, { playerId: speler.id, verlooptOp: Date.now() + RESET_TTL_MS })
        await stuurResetLinkMail(speler.email, speler.naam, token)
      }

      return res.status(200).json({
        success: true,
        message: 'Als deze combinatie van naam en e-mailadres bekend is, ontvang je een link om je pincode te wijzigen.'
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
      await kvSet(`loginPogingen:${speler.id}`, null)
      await stuurPincodeGewijzigdMail(speler.email, speler.naam)

      return res.status(200).json({ success: true, message: 'Pincode gewijzigd. Je kunt nu inloggen.' })
    }

    // Zelf pincode wijzigen (ingelogd), met huidige pincode ter bevestiging
    if (req.method === 'POST' && action === 'wijzig-pincode') {
      const { sessionToken, huidigePincode, nieuwePincode, nieuwePincodeHerhaal } = body
      const check = await haalSpelerViaSessie(sessionToken)
      if (check.fout) return res.status(401).json({ error: check.fout })
      const speler = check.speler

      if (!verifyPincode(huidigePincode || '', speler.pincodeHash)) {
        return res.status(403).json({ error: 'Huidige pincode is onjuist' })
      }
      if (!isGeldigePincode(nieuwePincode)) return res.status(400).json({ error: 'Nieuwe pincode moet uit 4 cijfers bestaan' })
      if (nieuwePincode !== nieuwePincodeHerhaal) return res.status(400).json({ error: 'Pincodes komen niet overeen' })

      const pincodeHash = hashPincode(nieuwePincode)
      await updatePlayer(speler.id, { pincodeHash })
      await stuurPincodeGewijzigdMail(speler.email, speler.naam)

      return res.status(200).json({ success: true, message: 'Pincode gewijzigd.' })
    }

    // Stap 1 van e-mail wijzigen: verificatielink naar het NIEUWE adres sturen
    if (req.method === 'POST' && action === 'vraag-email-wijziging-aan') {
      const { sessionToken, huidigePincode, nieuwEmail, nieuwEmailHerhaal } = body
      const check = await haalSpelerViaSessie(sessionToken)
      if (check.fout) return res.status(401).json({ error: check.fout })
      const speler = check.speler

      if (!verifyPincode(huidigePincode || '', speler.pincodeHash)) {
        return res.status(403).json({ error: 'Huidige pincode is onjuist' })
      }
      if (!isGeldigEmail(nieuwEmail)) return res.status(400).json({ error: 'Ongeldig e-mailadres' })
      if (nieuwEmail.toLowerCase().trim() !== (nieuwEmailHerhaal || '').toLowerCase().trim()) {
        return res.status(400).json({ error: 'E-mailadressen komen niet overeen' })
      }

      const token = genereerToken()
      await kvSet(`emailChangeToken:${token}`, {
        playerId: speler.id,
        nieuwEmail: nieuwEmail.toLowerCase().trim(),
        verlooptOp: Date.now() + VERIFY_TTL_MS,
      })
      await stuurEmailWijzigingVerificatieMail(nieuwEmail, speler.naam, token)

      return res.status(200).json({
        success: true,
        message: 'Check je nieuwe e-mailadres en klik op de link om de wijziging te bevestigen.'
      })
    }

    // Stap 2 van e-mail wijzigen: bevestiging via de link
    if (req.method === 'POST' && action === 'bevestig-email-wijziging') {
      const { token } = body
      if (!token) return res.status(400).json({ error: 'Token verplicht' })

      const data = await kvGet(`emailChangeToken:${token}`)
      if (!data) return res.status(400).json({ error: 'Ongeldige of al gebruikte link' })
      if (Date.now() > data.verlooptOp) return res.status(400).json({ error: 'Deze link is verlopen' })

      const speler = await getPlayerById(data.playerId)
      if (!speler) return res.status(404).json({ error: 'Speler niet gevonden' })

      const oudEmail = speler.email
      await verwijderUitEmailIndex(oudEmail, speler.id)
      await voegToeAanEmailIndex(data.nieuwEmail, speler.id)
      await updatePlayer(speler.id, { email: data.nieuwEmail })
      await kvSet(`emailChangeToken:${token}`, null)
      await stuurEmailGewijzigdMail(oudEmail, data.nieuwEmail, speler.naam)

      return res.status(200).json({ success: true, message: 'E-mailadres gewijzigd.' })
    }

    return res.status(400).json({ error: 'Onbekende actie' })
  } catch (err) {
    console.error('Auth handler error:', err)
    return res.status(500).json({ error: err.message })
  }
}
