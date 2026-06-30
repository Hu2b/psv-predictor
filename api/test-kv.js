import { kvGet, kvSet, kvDel } from './_kv.js'

export default async function handler(req, res) {
  const testKey = `test:kv:check:${Date.now()}`
  const testValue = { hallo: 'wereld', tijd: new Date().toISOString() }

  const setResult = await kvSet(testKey, testValue)
  const terug = await kvGet(testKey)
  await kvDel(testKey)

  res.status(200).json({
    key: testKey,
    geschreven: testValue,
    setResult,
    teruggelezen: terug,
  })
}
