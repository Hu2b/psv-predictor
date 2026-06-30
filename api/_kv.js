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
      try { return JSON.parse(d.result) } catch (_) { return d.result }
    }
    return d.result
  } catch (e) {
    console.error('kvGet error:', e.message)
    return null
  }
}

export async function kvSet(key, value, ttlSeconds = null) {
  if (!REDIS_URL || !REDIS_TOKEN) return false
  try {
    const url = ttlSeconds
      ? `${REDIS_URL}/set/${encodeURIComponent(key)}?EX=${ttlSeconds}`
      : `${REDIS_URL}/set/${encodeURIComponent(key)}`
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${REDIS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(value)
    })
    const d = await r.json()
    return d.result === 'OK'
  } catch (e) {
    console.error('kvSet error:', e.message)
    return false
  }
}

export async function kvDel(key) {
  if (!REDIS_URL || !REDIS_TOKEN) return
  try {
    await fetch(`${REDIS_URL}/del/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
    })
  } catch (e) {
    console.error('kvDel error:', e.message)
  }
}
