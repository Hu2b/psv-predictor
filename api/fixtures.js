import { kvGet, kvSet } from './_kv.js'

const API_KEY    = process.env.FOOTBALL_DATA_KEY
const API_BASE   = 'https://api.football-data.org/v4'

function bepaalSeizoen() {
  const nu = new Date()
  const jaar = nu.getFullYear()
  const maand = nu.getMonth() + 1
  const dag = nu.getDate()
  if (maand > 6 || (maand === 6 && dag >= 15)) return jaar
  return jaar - 1
}

const SEASON = parseInt(process.env.PSV_SEASON || String(bepaalSeizoen()))

const COMPETITIONS = { DED: 'ERE', CL: 'CL' }

// Nederlandse tijdzone offset (CET=+1, CEST=+2)
function getNLHour() {
  const nu = new Date()
  const nlStr = nu.toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam', hour: '2-digit', hour12: false })
  return parseInt(nlStr)
}

function getNLDatumKey() {
  const nu = new Date()
  return nu.toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit' })
}

// Bepaal tijdvenster (1=10-14u, 2=14-19u, 3=19-22u, 0=buiten vensters)
function getTijdvenster() {
  const uur = getNLHour()
  if (uur >= 10 && uur < 14) return 1
  if (uur >= 14 && uur < 19) return 2
  if (uur >= 19 && uur < 22) return 3
  return 0
}

function dagAfkorting(dateStr) {
  const d = new Date(dateStr)
  const dagen = ['zo','ma','di','wo','do','vr','za']
  return dagen[d.getDay()]
}

function formatDatum(dateStr) {
  const d = new Date(dateStr)
  const maanden = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']
  return `${dagAfkorting(dateStr)} ${d.getDate()} ${maanden[d.getMonth()]} ${d.getFullYear()}`
}

function teamAfkorting(naam) {
  const mapping = {
    'PSV Eindhoven':'PSV','PSV':'PSV','Ajax':'AJX','AFC Ajax':'AJX',
    'Feyenoord':'FEY','Feyenoord Rotterdam':'FEY',
    'AZ':'AZ ','AZ Alkmaar':'AZ ','FC Utrecht':'UTR','FC Twente':'TWE',
    'FC Twente Enschede':'TWE','NEC':'NEC','NEC Nijmegen':'NEC',
    'sc Heerenveen':'HEE','FC Groningen':'GRO','Almere City FC':'ALM',
    'Sparta Rotterdam':'SPA','Go Ahead Eagles':'GAE','RKC Waalwijk':'RKC',
    'PEC Zwolle':'PEC','Fortuna Sittard':'FOR','Willem II':'WIL',
    'NAC Breda':'NAC','Heracles Almelo':'HER','Excelsior':'EXC',
    'SC Cambuur':'CAM','FC Volendam':'VOL','Telstar 1963':'TEL',
    'SBV Excels
