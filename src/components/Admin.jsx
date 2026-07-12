import { useState, useEffect } from 'react'
import styles from './Admin.module.css'
import AdminBeheer from './AdminBeheer.jsx'
import AdminSpelers from './AdminSpelers.jsx'
import { teamNamenObject } from '../../shared/teams.js'

const COMPETITIES = ['JCS', 'ERE', 'KNVB', 'CL', 'UL']
const TEAM_NAMEN = teamNamenObject()
const SESSION_KEY = 'psv_session_token'

export default function Admin({ fixtures, onWedstrijdenGewijzigd }) {
  const [tab, setTab] = useState('uitslag')
  const [handmatig, setHandmatig] = useState([])
  const [melding, setMelding] = useState(null)
  const [gekozenMatch, setGekozenMatch] = useState('')
  const [homeScore, setHomeScore] = useState('')
  const [awayScore, setAwayScore] = useState('')
  const [resultaat, setResultaat] = useState(null)
  const [spelerNaamMap, setSpelerNaamMap] = useState({})
  const [comp, setComp] = useState('JCS')
  const [thuis, setThuis] = useState('')
  const [thuisNaam, setThuisNaam] = useState('')
  const [uit, setUit] = useState('')
  const [uitNaam, setUitNaam] = useState('')
  const [datum, setDatum] = useState('')
  // Kaart van matchId -> reeds opgeslagen eigen resultaat (uit /api/results).
  // Dit is de ENIGE betrouwbare bron om te weten of een wedstrijd al een
  // uitslag heeft binnen de app — het uitslag-veld op een wedstrijd uit
  // `fixtures` komt namelijk rechtstreeks van de live football-data.org-feed
  // en kan leeg zijn terwijl er intern al wél een resultaat is vastgelegd
  // (bijv. een handmatig ingevoerde testuitslag vóór de echte aftraptijd).
  const [resultatenMap, setResultatenMap] = useState({})

  async function laadResultaten() {
    try {
      const r = await fetch('/api/results?all=1')
      const data = await r.json()
      const map = {}
      for (const res of data.results || []) map[String(res.matchId)] = res
      setResultatenMap(map)
    } catch (_) {}
  }

  useEffect(() => {
    async function laad() {
      const sessionToken = localStorage.getItem(SESSION_KEY)
      const r = await fetch(`/api/admin?action=wedstrijden&sessionToken=${encodeURIComponent(sessionToken)}`)
      const data = await r.json()
      setHandmatig(data.wedstrijden || [])
    }
    laad()
    laadResultaten()

    async function laadSpelers() {
      try {
        const r = await fetch('/api/players')
        const data = await r.json()
        const map = {}
        for (const s of data.spelers || []) map[s.id] = s.naam
        setSpelerNaamMap(map)
      } catch (_) {}
    }
    laadSpelers()
  }, [])

  const alleWedstrijden = [...fixtures].sort((a, b) => new Date(a.datumISO) - new Date(b.datumISO))

  const gekozen = alleWedstrijden.find(f => String(f.matchId) === String(gekozenMatch))
  const bestaandResultaat = gekozen ? resultatenMap[String(gekozen.matchId)] : null

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
        sessionToken: localStorage.getItem(SESSION_KEY),
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
      setMelding({ type: 'ok', tekst: bestaandResultaat ? 'Uitslag bijgewerkt en punten herberekend!' : 'Uitslag opgeslagen en punten berekend!' })
      await laadResultaten()
      if (onWedstrijdenGewijzigd) onWedstrijdenGewijzigd()
    } else {
      setMelding({ type: 'fout', tekst: data.error || 'Fout' })
    }
  }

  // Herberekent een AL verwerkte wedstrijd opnieuw, met de HUIDIGE lijst van
  // geverifieerde spelers en de al bekende uitslag (niets hoeft opnieuw
  // ingetypt te worden). Nuttig als er na het verwerken van een uitslag nog
  // een nieuwe speler is bijgekomen, of een voorspelling achteraf is
  // gecorrigeerd — dit trekt de punten en lopende totalen recht.
  async function handleHerberekenen() {
    if (!gekozenMatch) return
    const r = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'herberekenen',
        sessionToken: localStorage.getItem(SESSION_KEY),
        matchId: gekozen.matchId,
      })
    })
    const data = await r.json()
    if (data.success) {
      setResultaat(data)
      setMelding({ type: 'ok', tekst: 'Punten herberekend met de huidige spelerslijst!' })
      await laadResultaten()
      if (onWedstrijdenGewijzigd) onWedstrijdenGewijzigd()
    } else {
      setMelding({ type: 'fout', tekst: data.error || 'Fout' })
    }
  }

  // Verwijdert een al vastgelegde uitslag weer — kan nu altijd, ook ná de
  // aftrap, zodat een beheerder een fout ook nog kan corrigeren nadat een
  // wedstrijd al (deels automatisch) verwerkt is. Voorspellingen van spelers
  // blijven gewoon staan; alleen de uitslag + toegekende punten verdwijnen.
  async function handleVerwijderUitslag() {
    if (!gekozen) return
    const isAlGespeeld = new Date() >= new Date(gekozen.datumISO)
    const waarschuwing = isAlGespeeld
      ? `Let op: deze wedstrijd is al gespeeld/verwerkt. Uitslag van ${gekozen.thuis} vs ${gekozen.uit} verwijderen? De toegekende punten van spelers voor deze wedstrijd vervallen dan ook (voorspellingen zelf blijven staan).`
      : `Uitslag van ${gekozen.thuis} vs ${gekozen.uit} verwijderen?`
    if (!window.confirm(waarschuwing)) return
    const r = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'verwijderUitslag',
        sessionToken: localStorage.getItem(SESSION_KEY),
        matchId: gekozen.matchId,
      })
    })
    const data = await r.json()
    if (data.success) {
      setResultaat(null)
      setHomeScore(''); setAwayScore('')
      setMelding({ type: 'ok', tekst: 'Uitslag verwijderd.' })
      await laadResultaten()
      if (onWedstrijdenGewijzigd) onWedstrijdenGewijzigd()
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
        action: 'toevoegen', sessionToken: localStorage.getItem(SESSION_KEY), competitie: comp,
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
      if (onWedstrijdenGewijzigd) onWedstrijdenGewijzigd()
    } else {
      setMelding({ type: 'fout', tekst: data.error || 'Fout' })
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.tabBar}>
        <button className={`${styles.tabBtn} ${tab === 'uitslag' ? styles.tabActief : ''}`} onClick={() => { setTab('uitslag'); setMelding(null) }}>Uitslag</button>
        <button className={`${styles.tabBtn} ${tab === 'toevoegen' ? styles.tabActief : ''}`} onClick={() => { setTab('toevoegen'); setMelding(null) }}>Toevoegen</button>
        <button className={`${styles.tabBtn} ${tab === 'beheer' ? styles.tabActief : ''}`} onClick={() => { setTab('beheer'); setMelding(null) }}>Beheer</button>
        <button className={`${styles.tabBtn} ${tab === 'spelers' ? styles.tabActief : ''}`} onClick={() => { setTab('spelers'); setMelding(null) }}>Spelers</button>
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
            onChange={e => {
              const nieuweId = e.target.value
              setGekozenMatch(nieuweId)
              setResultaat(null)
              const bestaand = resultatenMap[String(nieuweId)]
              if (bestaand) {
                setHomeScore(String(bestaand.uitslag.home))
                setAwayScore(String(bestaand.uitslag.away))
              } else {
                setHomeScore(''); setAwayScore('')
              }
            }}>
            <option value="">— Kies wedstrijd —</option>
            {alleWedstrijden.map(f => {
              const bestaand = resultatenMap[String(f.matchId)]
              return (
                <option key={f.matchId} value={f.matchId}>
                  #{f.volgnummer || '—'} {f.datum} — {f.thuis} vs {f.uit} ({f.competitie})
                  {bestaand ? ` [${bestaand.uitslag.home}-${bestaand.uitslag.away}]` : ''}
                </option>
              )
            })}
          </select>
          {gekozen && (
            <>
              <div className={styles.matchInfo}>
                <span className={styles.compTag}>{gekozen.competitie}</span>
                <span className={styles.matchNaam}>{gekozen.thuisNaam} vs {gekozen.uitNaam}</span>
              </div>
              {bestaandResultaat && !resultaat && (
                <div className={styles.melding} style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80' }}>
                  ✅ Deze wedstrijd heeft al een uitslag: <strong>{bestaandResultaat.uitslag.home}-{bestaandResultaat.uitslag.away}</strong>.
                  Hieronder alvast ingevuld — wijzig de score en sla op om te corrigeren, of gebruik "Herbereken" als de score klopt maar de punten niet (bijv. na een nieuwe speler).
                </div>
              )}
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
                {bestaandResultaat ? 'Uitslag wijzigen & punten herberekenen' : 'Uitslag opslaan & punten berekenen'}
              </button>
              {bestaandResultaat && (
                <button className={styles.btn} onClick={handleHerberekenen} style={{ marginTop: 8, background: 'transparent', border: '1px solid var(--psv-border)' }}>
                  🔄 Herbereken punten (huidige spelerslijst, zelfde score)
                </button>
              )}
              {bestaandResultaat && (
                <button className={styles.btn} onClick={handleVerwijderUitslag} style={{ marginTop: 8, background: 'transparent', border: '1px solid rgba(225,0,14,0.3)', color: '#f87171' }}>
                  🗑️ Uitslag verwijderen
                </button>
              )}
              {resultaat && (
                <div className={styles.resultaatBlok}>
                  {Object.entries(resultaat.result.predicties || {}).map(([playerId, pred]) => (
                    <div key={playerId} className={styles.resultaatRij}>
                      <span className={styles.resultaatNaam}>{spelerNaamMap[playerId] || '???'}</span>
                      <span className={styles.resultaatUitslag}>
                        {pred ? `${pred.home}-${pred.away}` : 'geen voorspelling'}
                      </span>
                      <span className={styles.punten}>+{resultaat.result.punten?.[playerId] ?? 0} pt</span>
                      <span className={styles.totaal}>Totaal: {resultaat.result.totalen?.[playerId] ?? '—'}</span>
                    </div>
                  ))}
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
          onWedstrijdenGewijzigd={onWedstrijdenGewijzigd}
        />
      )}

      {tab === 'spelers' && (
        <AdminSpelers setMelding={setMelding} />
      )}
    </div>
  )
}
