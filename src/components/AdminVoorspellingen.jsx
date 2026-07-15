import { useState } from 'react'
import styles from './Admin.module.css'

const SESSION_KEY = 'psv_session_token'

export default function AdminVoorspellingen({ alleWedstrijden, setMelding }) {
  const [predMatch, setPredMatch] = useState('')
  const [predicties, setPredicties] = useState([])
  const [predLaden, setPredLaden] = useState(false)
  const [onthuld, setOnthuld] = useState(true)

  async function laadVoorspellingen(matchId) {
    setPredLaden(true)
    try {
      const sessionToken = localStorage.getItem(SESSION_KEY)
      const r = await fetch(`/api/admin?action=voorspellingen&matchId=${matchId}&sessionToken=${encodeURIComponent(sessionToken)}`)
      const data = await r.json()
      setPredicties(data.predicties || [])
      setOnthuld(data.onthuld ?? true)
    } catch (_) {}
    setPredLaden(false)
  }

  async function verwijderVoorspelling(matchId, playerId) {
    const r = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verwijderVoorspelling', sessionToken: localStorage.getItem(SESSION_KEY), matchId, playerId })
    })
    const data = await r.json()
    if (data.success) {
      setMelding({ type: 'ok', tekst: playerId ? 'Voorspelling verwijderd' : 'Alle voorspellingen verwijderd' })
      await laadVoorspellingen(matchId)
    }
  }

  return (
    <div className={styles.sectie} style={{marginTop: 16}}>
      <label className={styles.label}>Voorspellingen beheren</label>
      <select className={styles.select} value={predMatch}
        onChange={e => {
          setPredMatch(e.target.value)
          setPredicties([])
          if (e.target.value) laadVoorspellingen(e.target.value)
        }}>
        <option value="">— Kies wedstrijd —</option>
        {alleWedstrijden.map(f => (
          <option key={f.matchId} value={f.matchId}>
            #{f.volgnummer || '—'} {f.datum} — {f.thuis} vs {f.uit}
          </option>
        ))}
      </select>

      {predLaden && <p className={styles.leegTekst}>Laden…</p>}

      {!predLaden && predMatch && predicties.length === 0 && (
        <p className={styles.leegTekst}>Nog geen voorspellingen voor deze wedstrijd</p>
      )}

      {!predLaden && predicties.length > 0 && (
        <div className={styles.predBlok}>
          {!onthuld && (
            <p className={styles.leegTekst}>
              🔒 Nog niet iedereen heeft voorspeld en de aftrap is nog niet geweest — scores zijn nog verborgen, ook voor jou.
            </p>
          )}
          {predicties.map(p => (
            <div key={p.playerId} className={styles.predRij}>
              <div className={styles.predInfo}>
                <span className={styles.predNaam}>{p.naam}</span>
                <span className={styles.predScore}>{p.verborgen ? '*****' : `${p.home}-${p.away}`}</span>
              </div>
              <button className={styles.btnKleinRood}
                onClick={() => verwijderVoorspelling(predMatch, p.playerId)}>🗑️</button>
            </div>
          ))}
          <button className={styles.btnKleinRood}
            style={{width:'100%', padding:'8px'}}
            onClick={() => verwijderVoorspelling(predMatch, null)}>
            🗑️ Alle voorspellingen verwijderen
          </button>
        </div>
      )}
    </div>
  )
}
