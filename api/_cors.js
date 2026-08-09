// Eén centrale plek voor CORS-headers. De app roept haar eigen /api/*
// altijd same-origin aan (de browser doet dan géén CORS-controle), dus een
// specifieke toegestane origin i.p.v. '*' breekt de app niet — maar het
// voorkomt wél dat een willekeurige andere website deze endpoints vanuit de
// browser van een bezoeker kan uitlezen of aanroepen.
const TOEGESTANE_ORIGIN = process.env.APP_BASE_URL || 'https://psv-predictor.vercel.app'

export function zetCors(res, methods = 'GET, POST, OPTIONS') {
  res.setHeader('Access-Control-Allow-Origin', TOEGESTANE_ORIGIN)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', methods)
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}
