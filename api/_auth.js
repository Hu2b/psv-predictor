import { kvGet } from './_kv.js'
import { getPlayerById, isAdmin, verifyPincode } from './_players.js'

// Volledige check voor gevoelige beheerdersacties: geldige sessie + de
// beheerder moet zijn EIGEN pincode opnieuw invoeren ter bevestiging.
export async function verifieerBeheerder(sessionToken, adminPincode) {
  if (!sessionToken || !adminPincode) return { fout: 'sessionToken en pincode zijn verplicht' }

  const sessie = await kvGet(`session:${sessionToken}`)
  if (!sessie) return { fout: 'Sessie verlopen, log opnieuw in' }

  const beheerder = await getPlayerById(sessie.playerId)
  if (!beheerder) return { fout: 'Speler niet gevonden' }
  if (!isAdmin(beheerder.email)) return { fout: 'Geen beheerrechten' }
  if (!verifyPincode(adminPincode, beheerder.pincodeHash)) return { fout: 'Onjuiste pincode' }

  return { beheerder }
}

// Lichtere check voor read-only beheerdersacties: alleen geldige sessie +
// adminrechten, geen herbevestiging met pincode nodig.
export async function verifieerBeheerderSessie(sessionToken) {
  if (!sessionToken) return { fout: 'sessionToken verplicht' }

  const sessie = await kvGet(`session:${sessionToken}`)
  if (!sessie) return { fout: 'Sessie verlopen, log opnieuw in' }

  const beheerder = await getPlayerById(sessie.playerId)
  if (!beheerder || !isAdmin(beheerder.email)) return { fout: 'Geen beheerrechten' }

  return { beheerder }
}

export function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
}
