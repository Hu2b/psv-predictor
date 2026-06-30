const REDIS_URL   = process.env.KV_REST_API_URL
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN

export async function kvGet(key) {
  if (!REDIS_URL || !REDIS_TOKEN) return null
  try {
    const r = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
    })
    const d = await r.json()
    if (d.result === null || d.result === undefined) return null
    if (typeof d.result === 'string') {
      try { return JSON.parse(d.result) } catch (_) { return null }
    }
    return d.result
  } catch (e) { return null }
}

export async function kvSet(key, value, ttlSeconds = null) {
  if (!REDIS_URL || !REDIS_TOKEN) return
  try {
    const encoded = encodeURIComponent(JSON.stringify(value))
    const url = ttlSeconds
      ? `${REDIS_URL}/set/${encodeURIComponent(key)}/${encoded}/EX/${ttlSeconds}`
      : `${REDIS_URL}/set/${encodeURIComponent(key)}/${encoded}`
    await fetch(url, { headers: { Authorization: `Bearer ${REDIS_TOKEN}` } })
  } catch (e) {}
}

export async function kvDel(key) {
  if (!REDIS_URL || !REDIS_TOKEN) return
  try {
    await fetch(`${REDIS_URL}/del/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
    })
  } catch (e) {}
}
