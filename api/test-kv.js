import { kvGet, kvSet } from './_kv.js'

export default async function handler(req, res) {
  const testKey = 'test:kv:check'
  const testValue = { hallo: 'wereld', tijd: new Date().toISOString() }

  await kvSet(testKey, testValue)
  const terug = await kvGet(testKey)

  res.status(200).json({
    geschreven: testValue,
    teruggelezen: terug,
    werkt: JSON.stringify(testValue) === JSON.stringify(terug),
    heeftEnvVars: {
      url: !!process.env.KV_REST_API_URL,
      token: !!process.env.KV_REST_API_TOKEN,
    }
  })
}
