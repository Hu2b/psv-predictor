import { useState, useEffect } from 'react'
import styles from './Admin.module.css'

const COMPETITIES = ['JCS', 'ERE', 'KNVB', 'CL', 'UL']

const TEAM_NAMEN = {
  'PSV': 'PSV Eindhoven', 'AJX': 'Ajax', 'FEY': 'Feyenoord',
  'AZ': 'AZ Alkmaar', 'UTR': 'FC Utrecht', 'TWE': 'FC Twente',
  'NEC': 'NEC Nijmegen', 'HEE': 'sc Heerenveen', 'GRO': 'FC Groningen',
  'ALM': 'Almere City FC', 'SPA': 'Sparta Rotterdam', 'GAE': 'Go Ahead Eagles',
  'RKC': 'RKC Waalwijk', 'PEC': 'PEC Zwolle', 'FOR': 'Fortuna Sittard',
  'WIL': 'Willem II', 'NAC': 'NAC Breda', 'HER': 'Heracles Almelo',
  'EXC': 'Excelsior', 'CAM': 'SC Cambuur', 'VOL': 'FC Volendam',
  'TEL': 'Telstar 1963', 'SBV': 'SBV Excelsior', 'SCH': 'Schalke 04',
  'ADO': 'ADO Den Haag', 'ROY': 'Royale Union SG', 'BAR': 'FC Barcelona',
  'REA': 'Real Madrid', 'MCI': 'Manchester City', 'LIV': 'Liverpool FC',
  'JUV': 'Juventus', 'PSG': 'Paris SG', 'MUN': 'Manchester United',
  'CHE': 'Chelsea FC', 'ARS': 'Arsenal FC', 'ATM': 'Atlético Madrid',
  'INT': 'Inter Milan', 'ACM': 'AC Milan', 'BOR': 'Borussia Dortmund',
  'BAY': 'Bayern München',
}

// Lokale datetime string voor input (YYYY-MM-DDTHH:MM)
function toLocalInput(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Lokale input naar ISO zonder UTC conversie
function localInputToISO(val) {
  if (!val) return ''
  // val is "YYYY-MM-DDTHH:MM" — bewaar als lokale tijd
  return new Date(val).toISOString()
}

export default function Admin({ fixtures }) {
  const [tab, setTab] = useState('uitslag')
  const [handmatig, setHandmatig] = useState([])
  const [melding, setMelding] = useState(null)

  const [gekozenMatch, setGekozenMatch] = useState('')
  const [homeScore, setHomeScore] = useState('')
  const [awayScore, setAwayScore] = useState('')
  const [resultaat, setResultaat] = useState(null)

  const [comp, setComp] = useState('JCS')
  const [thuis, setThuis] = useState('')
  const [thuisNaam, setThuisNaam] = useState('')
  const [uit, setUit] = useState('')
  const [uitNaam, setUitNaam] = useState('')
  const [datum, setDatum] = useState('')

  const [wijzigenId, setWijzigenId] = useState(null)
  const [wijzigenData, setWijzigenData] = useState({})

  useEffect(() => {
    async function laad() {
      const r = await fetch('/api/admin?action=wedstrijden')
      const data = await r.json()
      setHandmatig(data.wedstrijden || [])
    }
    laad()
  }, [])

  const alleWedstrijden = [...fixtures, ...handmatig]
    .sort((a, b) => new Date(a.datumISO) - new Date(b.datumISO))

  const gekozen = alleWedstrijden.find(f => String(f.matchId) === String(gekozenMatch))

  function handleThuisAfkorting(val) {
    const upper = val.toUpperCase()
    setThuis(upper)
    if (TEAM_NAMEN[upper]) setThuisNaam(TEAM_NAMEN[upper])
  }

  function handleUitAfkorting(val) {
    const upper = val.toUpperCase()
    setUit(upper)
    if (TEAM_NAMEN[upper]) setUitNaam(TEAM_NAMEN[upper])
  }

  async function handleUitslag() {
    if (!gekozenMatch || homeScore === '' || awayScore === '') {
      setMelding({ type: 'fout', tekst: 'Vul alle velden in' })
      return
    }
    setMelding(null)
    const r = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'uitslag',
        matchId: gekozen.matchId,
        homeScore: parseInt(homeScore),
        awayScore: parseInt(awayScore),
        matchInfo: {
          datumISO: gekozen.datumISO,
          datum: gekozen.datum,
          competitie: gekozen.competitie,
          thuis: gekozen.thuis,
          uit: gekozen.uit,
        }
      })
    })
    const data = await r.json()
    if (data.success) {
      setResultaat(data)
      setMelding({ type: 'ok', tekst: `Opgeslagen! Niek: ${data.punten.niek}pt, Huub: ${data.punten.huub}pt` })
    } else {
      setMelding({ type: 'fout', tekst: data.error || 'Fout bij opslaan' })
    }
  }

  async function handleToevoegen() {
    if (!thuis || !uit || !datum) {
      setMelding({ type: 'fout', tekst: 'Vul alle velden in' })
      return
    }
    const datumISO = localInputToISO(datum)
    const datumLabel = new Date(datum).toLocaleDateString('nl-NL', {
      weekday:'short', day:'numeric', month:'short', year:'numeric'
    })
    const r = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'toevoegen',
        competitie: comp,
        thuis: thuis.substring(0,3),
        thuisNaam: thuisNaam || thuis,
        uit: uit.substring(0,3),
        uitNaam: uitNaam || uit,
        datum: datumLabel,
        datumISO,
      })
    })
    const data = await r.json()
    if (data.success) {
      const nieuw = data.wedstrijd
      setHandmatig(prev => [...prev, nieuw])
      setThuis(''); setThuisNaam(''); setUit(''); setUitNaam(''); setDatum('')
      setMelding({ type: 'ok', tekst: 'Wedstrijd toegevoegd!' })
      setGekozenMatch(String(nieuw.matchId))
      setHomeScore(''); setAwayScore(''); setResultaat(null)
      setTab('uitslag')
    } else {
      setMelding({ type: 'fout', tekst: data.error || 'Fout bij toevoegen' })
    }
  }

  function startWijzigen(w) {
    setWijzigenId(w.matchId)
    setWijzigenData({
      competitie: w.competitie,
      thuis: w.thuis,
      thuisNaam: w.thuisNaam || '',
      uit: w.uit,
      uitNaam: w.uitNaam || '',
      datumISO: toLocalInput(w.datumISO),
    })
  }

  async function handleWijzigen() {
    const datumISO = localInputToISO(wijzigenData.datumISO)
    const datumLabel = new Date(wijzigenData.datumISO).toLocaleDateString('nl-NL', {
      weekday:'short', day:'numeric', month:'short', year:'numeric'
    })
    const r = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'wijzigen',
        matchId: wijzigenId,
        ...wijzigenData,
        datum: datumLabel,
        datumISO,
      })
    })
    const data = await r.json()
    if (data.success) {
      setHandmatig(prev => prev.map(w => w.matchId === wijzigenId ? data.wedstrijd : w))
      setWijzigenId(null)
      setMelding({ type: 'ok', tekst: 'Wedstrijd gewijzigd!' })
    } else {
      setMelding({ type: 'fout', tekst: data.error })
    }
  }

  async function handleVerwijderen(matchId) {
    if (!confirm('Wedstrijd verwijderen?')) return
    const r = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verwijderen', matchId })
    })
    const data = await r.json()
    if (data.success) {
      setHandmatig(prev => prev.filter(w => w.matchId !== matchId))
      setMelding({ type: 'ok', tekst: 'Wedstrijd verwijderd' })
    }
  }

  return (
    <div className={styles.wrapper}>
      <h2 className={styles.titel}>Admin</h2>

      <div className={styles.tabBar}>
        <button className={`${styles.tabBtn} ${tab === 'uitslag' ? styles.tabActief : ''}`} onClick={() => setTab('uitslag')}>
          Uitslag invoeren
        </button>
        <button className={`${styles.tabBtn} ${tab === 'toevoegen' ? styles.tabActief : ''}`} onClick={() => setTab('toevoegen')}>
          Toevoegen
        </button>
        <button className={`${styles.tabBtn} ${tab === 'beheer' ? styles.tabActief : ''}`} onClick={() => setTab('beheer')}>
          Beheer
        </button>
      </div>

      {melding && (
        <div className={`${styles.melding} ${melding.type === 'ok' ? styles.meldingOk : styles.meldingFout}`}>
          {melding.tekst}
        </div>
      )}

      {tab === 'uitslag' && (
        <div className={styles.sectie}>
          <label className={styles.label}>Wedstrijd</label>
          <select
            className={styles.select}
            value={gekozenMatch}
            onChange={e => { setGekozenMatch(e.target.value); setResultaat(null); setHomeScore(''); setAwayScore('') }}
          >
            <option value="">— Kies wedstrijd —</option>
            {alleWedstrijden.map(f => (
              <option key={f.matchId} value={f.matchId}>
                {f.datum} — {f.thuis} vs {f.uit} ({f.competitie})
                {f.uitslag ? ` [${f.uitslag.home}-${f.uitslag.away}]` : ''}
              </option>
            ))}
          </select>

          {gekozen && (
            <>
              <div className={styles.matchInfo}>
                <span className={styles.compTag}>{gekozen.competitie}</span>
                <span className={styles.matchNaam}>{gekozen.thuisNaam} vs {gekozen.uitNaam}</span>
              </div>
              <div className={styles.scoreRij}>
                <div className={styles.scoreBlok}>
                  <label className={styles.scoreLabel}>{gekozen.thuis}</label>
                  
