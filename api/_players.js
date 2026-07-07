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

export async function getPlayerByEmail(email) {
  if (!email) return null
  const id = await kvGet(`playerByEmail:${email.toLowerCase().trim()}`)
  if (!id) return null
  return await getPlayerById(id)
}

export async function telSpelers() {
  const index = await kvGet('players:index') || []
  return index.length
}

export async function alleSpelers() {
  const index = await kvGet('players:index') || []
  const spelers = await Promise.all(index.map(id => getPlayerById(id)))
  return spelers.filter(Boolean)
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
  await kvSet(`playerByEmail:${email.toLowerCase().trim()}`, id)

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
