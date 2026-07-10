import crypto from 'crypto'
import { kvGet, kvSet } from './_kv.js'

const ITERATIONS = 100000
const KEYLEN = 32
const DIGEST = 'sha256'

export function hashPincode(pincode) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(pincode, salt, ITERATIONS, KEYLEN, DIGEST).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPincode(pincode, opgeslagen) {
  if (!opgeslagen || !opgeslagen.includes(':')) return false
  const [salt, hash] = opgeslagen.split(':')
  const check = crypto.pbkdf2Sync(pincode, salt, ITERATIONS, KEYLEN, DIGEST).toString('hex')
  const a = Buffer.from(hash, 'hex')
  const b = Buffer.from(check, 'hex')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export function genereerToken() {
  return crypto.randomBytes(32).toString('hex')
}

export function isGeldigeNaam(naam) {
  return typeof naam === 'string' && naam.trim().length >= 2 && naam.trim().length <= 20
}

export function isGeldigEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function isGeldigePincode(pincode) {
  return typeof pincode === 'string' && /^\d{4}$/.test(pincode)
}

export async function getPlayerById(id) {
  if (!id) return null
  return await kvGet(`player:${id}`)
}

export async function getPlayerByNaam(naam) {
  if (!naam) return null
  const id = await kvGet(`playerByNaam:${naam.toLowerCase().trim()}`)
  if (!id) return null
  return await getPlayerById(id)
}

// E-mail is NIET uniek: meerdere spelers kunnen hetzelfde adres gebruiken.
// Deze functie geeft daarom altijd een array terug.
export async function getSpelersByEmail(email) {
  if (!email) return []
  const ids = await kvGet(`playersByEmail:${email.toLowerCase().trim()}`) || []
  const spelers = await Promise.all(ids.map(id => getPlayerById(id)))
  return spelers.filter(Boolean)
}

export async function voegToeAanEmailIndex(email, playerId) {
  const key = `playersByEmail:${email.toLowerCase().trim()}`
  const ids = await kvGet(key) || []
  if (!ids.includes(playerId)) {
    ids.push(playerId)
    await kvSet(key, ids)
  }
}

export async function verwijderUitEmailIndex(email, playerId) {
  const key = `playersByEmail:${email.toLowerCase().trim()}`
  const ids = await kvGet(key) || []
  const nieuw = ids.filter(id => id !== playerId)
  await kvSet(key, nieuw)
}

// Telt ALLE geregistreerde spelers (geverifieerd of niet) — gebruikt voor de
// max-10-registratielimiet: ook een nog niet geverifieerd account bezet een plek.
export async function telSpelers() {
  const index = await kvGet('players:index') || []
  return index.length
}

// Geeft ALLE geregistreerde spelers terug (geverifieerd of niet). Gebruik dit
// NIET voor puntenverwerking of "iedereen heeft voorspeld"-logica — daarvoor
// alleGeverifieerdeSpelers()/telGeverifieerdeSpelers() gebruiken, anders blijft
// een nooit-bevestigd account als "???" in het klassement hangen en kan de
// vroegtijdige onthulling nooit meer waar worden.
export async function alleSpelers() {
  const index = await kvGet('players:index') || []
  const spelers = await Promise.all(index.map(id => getPlayerById(id)))
  return spelers.filter(Boolean)
}

// Alleen spelers die hun e-mailadres bevestigd hebben — dit zijn de enige
// spelers die kunnen inloggen en dus kunnen voorspellen. Gebruikt door
// berekenEnSlaResultaatOp() (puntenverwerking) en prediction.js
// ("iedereen heeft voorspeld"-check), zodat een hangend, nooit bevestigd
// account niet als "???" in het klassement verschijnt en niet permanent
// blokkeert dat voorspellingen vroegtijdig onthuld worden.
export async function alleGeverifieerdeSpelers() {
  const spelers = await alleSpelers()
  return spelers.filter(s => s.geverifieerd)
}

export async function telGeverifieerdeSpelers() {
  const spelers = await alleGeverifieerdeSpelers()
  return spelers.length
}

export async function maakSpeler({ naam, email, pincode }) {
  const id = `player_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
  const pincodeHash = hashPincode(pincode)
  const speler = {
    id,
    naam: naam.trim(),
    email: email.toLowerCase().trim(),
    pincodeHash,
    geverifieerd: false,
    aangemaaktOp: new Date().toISOString(),
  }
  await kvSet(`player:${id}`, speler)
  await kvSet(`playerByNaam:${naam.toLowerCase().trim()}`, id)
  await voegToeAanEmailIndex(email, id)

  const index = await kvGet('players:index') || []
  index.push(id)
  await kvSet('players:index', index)

  return speler
}

export async function updatePlayer(id, updates) {
  const speler = await getPlayerById(id)
  if (!speler) return null
  const nieuw = { ...speler, ...updates }
  await kvSet(`player:${id}`, nieuw)
  return nieuw
}

export function isAdmin(email) {
  if (!email) return false
  const lijst = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
  return lijst.includes(email.toLowerCase())
}
