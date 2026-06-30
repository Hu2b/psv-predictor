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
  } catch (e) { return null }
}

export async function kvSet(key, value, ttlSeconds = null) {
  if (!REDIS_URL || !REDIS_TOKEN) return false
  try {
    const serialized = JSON.stringify(value)
    // Upstash REST: POST /pipeline met array van commando's
    const commands = ttlSeconds
      ? [['SET', key, serialized, 'EX', ttlSeconds]]
      : [['SET', key, serialized]]
    const r = await fetch(`${REDIS_URL}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${REDIS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(commands)
    })
    const d = await r.json()
    return d?.[0]?.result === 'OK'
  } catch (e) { return false }
}

export async function kvDel(key) {
  if (!REDIS_URL || !REDIS_TOKEN) return
  try {
    await fetch(`${REDIS_URL}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${REDIS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([['DEL', key]])
    })
  } catch (e) {}
}
