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

export default function Admin({ fixtures }) {
  const [tab, setTab] = useState('uitslag')
  const [handmatig, setHandmatig] = useState([])
  const [melding, setMelding] = useState(null)

  // Uitslag state
  const [gekozenMatch, setGekozenMatch] = useState('')
  const [homeScore, setHomeScore] = useState('')
  const [awayScore, setAwayScore] = useState('')
  const [resultaat, setResultaat] = useState(null)

  // Toevoegen state
  const [comp, setComp] = useState('JCS')
  const [thuis, setThuis] = useState('')
  const [thuisNaam, setThuisNaam] = useState('')
  const [uit, setUit] = useState('')
  const [uitNaam, setUitNaam] = useState('')
  const [datum, setDatum] = useState('')

  // Wijzigen state
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
    const datumISO = new Date(datum).toISOString()
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
        datum: new Date(datum).toLocaleDateString('nl-NL', {weekday:'short', day:'numeric', month:'short', year:'numeric'}),
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
      thuisNaam: w.thuisNaam,
      uit: w.uit,
      uitNaam: w.uitNaam,
      datumISO: w.datumISO?.substring(0,16) || '',
    })
  }

  async function handleWijzigen() {
    const r = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'wijzigen',
        matchId: wijzigenId,
        ...wijzigenData,
        datumISO: new Date(wijzigenData.datumISO).toISOString(),
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
          Wedstrijd toevoegen
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
                  <input type="number" min="0" max="20" value={homeScore}
                    onChange={e => setHomeScore(e.target.value)}
                    className={styles.scoreInput} placeholder="0" inputMode="numeric" />
                </div>
                <span className={styles.scoreDash}>–</span>
                <div className={styles.scoreBlok}>
                  <label className={styles.scoreLabel}>{gekozen.uit}</label>
                  <input type="number" min="0" max="20" value={awayScore}
                    onChange={e => setAwayScore(e.target.value)}
                    className={styles.scoreInput} placeholder="0" inputMode="numeric" />
                </div>
              </div>
              <button className={styles.btn} onClick={handleUitslag}>
                Uitslag opslaan & punten berekenen
              </button>
              {resultaat && (
                <div className={styles.resultaatBlok}>
                  <div className={styles.resultaatRij}>
                    <span>Niek: {resultaat.result.predNiek ? `${resultaat.result.predNiek.home}-${resultaat.result.predNiek.away}` : '—'}</span>
                    <span className={styles.punten}>+{resultaat.punten.niek} pt</span>
                    <span className={styles.totaal}>Totaal: {resultaat.totals.niek}</span>
                  </div>
                  <div className={styles.resultaatRij}>
                    <span>Huub: {resultaat.result.predHuub ? `${resultaat.result.predHuub.home}-${resultaat.result.predHuub.away}` : '—'}</span>
                    <span className={styles.punten}>+{resultaat.punten.huub} pt</span>
                    <span className={styles.totaal}>Totaal: {resultaat.totals.huub}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'toevoegen' && (
        <div className={styles.sectie}>
          <label className={styles.label}>Competitie</label>
          <select className={styles.select} value={comp} onChange={e => setComp(e.target.value)}>
            {COMPETITIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <label className={styles.label}>Datum & tijd</label>
          <input type="datetime-local" className={styles.input} value={datum} onChange={e => setDatum(e.target.value)} />
          <div className={styles.teamRij}>
            <div className={styles.teamBlok}>
              <label className={styles.label}>Thuis (3-letter)</label>
              <input className={styles.input} value={thuis} onChange={e => handleThuisAfkorting(e.target.value)} placeholder="PSV" maxLength={3} />
              <label className={styles.label}>Volledige naam</label>
              <input className={styles.input} value={thuisNaam} onChange={e => setThuisNaam(e.target.value)} placeholder="PSV Eindhoven" />
            </div>
            <div className={styles.teamBlok}>
              <label className={styles.label}>Uit (3-letter)</label>
              <input className={styles.input} value={uit} onChange={e => handleUitAfkorting(e.target.value)} placeholder="AJX" maxLength={3} />
              <label className={styles.label}>Volledige naam</label>
              <input className={styles.input} value={uitNaam} onChange={e => setUitNaam(e.target.value)} placeholder="Ajax" />
            </div>
          </div>
          <button className={styles.btn} onClick={handleToevoegen}>Wedstrijd toevoegen</button>
        </div>
      )}

      {tab === 'beheer' && (
        <div className={styles.sectie}>
          <label className={styles.label}>Handmatig toegevoegde wedstrijden</label>
          {handmatig.length === 0 && (
            <p className={styles.leegTekst}>Geen handmatige wedstrijden</p>
          )}
          {handmatig.map(w => (
            <div key={w.matchId} className={styles.beheerRij}>
              {wijzigenId === w.matchId ? (
                
