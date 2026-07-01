import { useState, useEffect } from 'react'
import styles from './Admin.module.css'
import AdminBeheer from './AdminBeheer.jsx'

const COMPETITIES = ['JCS', 'ERE', 'KNVB', 'CL', 'UL']
const TEAM_NAMEN = {
  'PSV': 'PSV Eindhoven', 'AJX': 'Ajax', 'FEY': 'Feyenoord',
  'AZ': 'AZ Alkmaar', 'UTR': 'FC Utrecht', 'TWE': 'FC Twente',
  'NEC': 'NEC Nijmegen', 'HEE': 'sc Heerenveen', 'GRO': 'FC Groningen',
  'ALM': 'Almere City FC', 'SPA': 'Sparta Rotterdam', 'GAE': 'Go Ahead Eagles',
  'RKC': 'RKC Waalwijk', 'PEC': 'PEC Zwolle', 'FOR': 'Fortuna Sittard',
  'WIL': 'Willem II', 'NAC': 'NAC Breda', 'HER': 'Heracles Almelo',
  'EXC': 'Excelsior', 'VOL': 'FC Volendam', 'TEL': 'Telstar 1963',
  'ADO': 'ADO Den Haag', 'BAR': 'FC Barcelona', 'REA': 'Real Madrid',
  'MCI': 'Manchester City', 'LIV': 'Liverpool FC', 'BAY': 'Bayern München',
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

  // handmatig is alleen nodig voor het Beheer-tabblad (wijzigen/verwijderen van
  // eigen handmatige wedstrijden). De volledige, genummerde lijst komt via de
  // fixtures-prop, die al gemerged en gesorteerd is in api/_wedstrijden.js.
  useEffect(() => {
    async function laad() {
      const r = await fetch('/api/admin?action=wedstrijden')
      const data = await r.json()
      setHandmatig(data.wedstrijden || [])
    }
    laad()
  }, [])

  const alleWedstrijden = [...fixtures].sort((a, b) => new Date(a.datumISO) - new Date(b.datumISO))

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
      setMelding({ type: 'fout', tekst: 'Vul alle velden in' }); return
    }
    const r = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'uitslag',
        matchId: gekozen.matchId,
        homeScore: parseInt(homeScore),
        awayScore: parseInt(awayScore),
        matchInfo: {
          datumISO: gekozen.datumISO, datum: gekozen.datum,
          competitie: gekozen.competitie, thuis: gekozen.thuis, uit: gekozen.uit
        }
      })
    })
    const data = await r.json()
    if (data.success) {
      setResultaat(data)
      setMelding({ type: 'ok', tekst: `Opgeslagen! Niek: ${data.punten.niek}pt, Huub: ${data.punten.huub}pt` })
    } else {
      setMelding({ type: 'fout', tekst: data.error || 'Fout' })
    }
  }

  async function handleToevoegen() {
    if (!thuis || !uit || !datum) {
      setMelding({ type: 'fout', tekst: 'Vul alle velden in' }); return
    }
    const datumISO = new Date(datum).toISOString()
    const datumLabel = new Date(datum).toLocaleDateString('nl-NL', {
      weekday:'short', day:'numeric', month:'short', year:'numeric'
    })
    const r = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'toevoegen', competitie: comp,
        thuis: thuis.substring(0,3), thuisNaam: thuisNaam || thuis,
        uit: uit.substring(0,3), uitNaam: uitNaam || uit,
        datum: datumLabel, datumISO
      })
    })
    const data = await r.json()
    if (data.success) {
      setHandmatig(prev => [...prev, data.wedstrijd])
      setThuis(''); setThuisNaam(''); setUit(''); setUitNaam(''); setDatum('')
      setGekozenMatch(String(data.wedstrijd.matchId))
      setHomeScore(''); setAwayScore(''); setResultaat(null)
      setMelding({ type: 'ok', tekst: 'Wedstrijd toegevoegd!' })
      setTab('uitslag')
    } else {
      setMelding({ type: 'fout', tekst: data.error || 'Fout' })
    }
  }

  return (
    <div className={styles.wrapper}>
      <h2 className={styles.titel}>Admin</h2>
      <div className={styles.tabBar}>
        <button className={`${styles.tabBtn} ${tab === 'uitslag' ? styles.tabActief : ''}`} onClick={() => setTab('uitslag')}>Uitslag</button>
        <button className={`${styles.tabBtn} ${tab === 'toevoegen' ? styles.tabActief : ''}`} onClick={() => setTab('toevoegen')}>Toevoegen</button>
        <button className={`${styles.tabBtn} ${tab === 'beheer' ? styles.tabActief : ''}`} onClick={() => setTab('beheer')}>Beheer</button>
      </div>

      {melding && (
        <div className={`${styles.melding} ${melding.type === 'ok' ? styles.meldingOk : styles.meldingFout}`}>
          {melding.tekst}
        </div>
      )}

      {tab === 'uitslag' && (
        <div className={styles.sectie}>
          <label className={styles.label}>Wedstrijd</label>
          <select className={styles.select} value={gekozenMatch}
            onChange={e => { setGekozenMatch(e.target.value); setResultaat(null); setHomeScore(''); setAwayScore('') }}>
            <option value="">— Kies wedstrijd —</option>
            {alleWedstrijden.map(f => (
              <option key={f.matchId} value={f.matchId}>
                #{f.volgnummer || '—'} {f.datum} — {f.thuis} vs {f.uit} ({f.competitie})
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
          <input type="datetime-local" className={styles.inputDatum}
            value={datum} onChange={e => setDatum(e.target.value)} />
          <div className={styles.teamRij}>
            <div className={styles.teamBlok}>
              <label className={styles.label}>Thuis</label>
              <input className={styles.input} value={thuis}
                onChange={e => handleThuisAfkorting(e.target.value)} placeholder="PSV" maxLength={3} />
              <input className={styles.input} value={thuisNaam}
                onChange={e => setThuisNaam(e.target.value)} placeholder="PSV Eindhoven" />
            </div>
            <div className={styles.teamBlok}>
              <label className={styles.label}>Uit</label>
              <input className={styles.input} value={uit}
                onChange={e => handleUitAfkorting(e.target.value)} placeholder="AJX" maxLength={3} />
              <input className={styles.input} value={uitNaam}
                onChange={e => setUitNaam(e.target.value)} placeholder="Ajax" />
            </div>
          </div>
          <button className={styles.btn} onClick={handleToevoegen}>Wedstrijd toevoegen</button>
        </div>
      )}

      {tab === 'beheer' && (
        <AdminBeheer
          handmatig={handmatig}
          setHandmatig={setHandmatig}
          setMelding={setMelding}
          alleWedstrijden={alleWedstrijden}
        />
      )}
    </div>
  )
}
