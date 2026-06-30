import { kvDel } from './_kv.js'

export default async function handler(req, res) {
  await kvDel('psv:fixtures:fd')
  await kvDel('psv:fixtures:fd:2025')
  await kvDel('psv:fixtures:fd:2026')
  res.status(200).json({ cleared: true })
}
