import { useState } from 'react'
import styles from './Admin.module.css'

export default function AdminVoorspellingen({ alleWedstrijden, setMelding }) {
  const [predMatch, setPredMatch] = useState('')
  const [predData, setPredData] = useState(null)
  const [predLaden, setPredLaden] = useState(false)

  async function laadVoorspellingen(matchId) {
    setPredLaden(true)
    try {
      const r = await fetch(`/api/admin?action=voorspellingen&matchId=${matchId}`)
      const data = await r.json()
      setPredData(data)
    } catch (_) {}
    setPredLaden(false)
  }

  async function verwijderVoorspelling(matchId, speler) {
    const r = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verwijderVoorspelling', matchId, speler })
    })
    const data = await r.json()
    if (data.success) {
      setMelding({ type: 'ok', tekst: speler ? `Voorspelling ${speler} verwijderd` : 'Beide voorspellingen verwijderd' })
      await laadVoorspellingen(matchId)
    }
  }

  return (
    <div className={styles.sectie} style={{marginTop: 16}}>
      <label className={styles.label}>Voorspellingen beheren</label>
      <select className={styles.select} value={predMatch}
        onChange={e => {
          setPredMatch(e.target.value)
          setPredData(null)
          if (e.target.value) laadVoorspellingen(e.target.value)
        }}>
        <option value="">— Kies wedstrijd —</option>
        {alleWedstrijden.map(f => (
          <option key={f.matchId} value={f.matchId}>
            #{f.volgnummerBerekend} {f.datum} — {f.thuis} vs {f.uit}
          </option>
        ))}
      </select>

      {predLaden && <p className={styles.leegTekst}>Laden…</p>}

      {predData && !predLaden && (
        <div className={styles.predBlok}>
          <div className={styles.predRij}>
            <div className={styles.predInfo}>
              <span className={styles.predNaam}>Niek</span>
              {predData.niek?.confirmed
                ? <span className={styles.predScore}>{predData.niek.home}-{predData.niek.away}</span>
                : <span className={styles.predLeeg}>Nog niet ingevuld</span>}
            </div>
            {predData.niek?.confirmed && (
              <button className={styles.btnKleinRood}
                onClick={() => verwijderVoorspelling(predMatch, 'niek')}>🗑️</button>
            )}
          </div>
          <div className={styles.predRij}>
            <div className={styles.predInfo}>
              <span className={styles.predNaam}>Huub</span>
              {predData.huub?.confirmed
                ? <span className={styles.predScore}>{predData.huub.home}-{predData.huub.away}</span>
                : <span className={styles.predLeeg}>Nog niet ingevuld</span>}
            </div>
            {predData.huub?.confirmed && (
              <button className={styles.btnKleinRood}
                onClick={() => verwijderVoorspelling(predMatch, 'huub')}>🗑️</button>
            )}
          </div>
          {(predData.niek?.confirmed || predData.huub?.confirmed) && (
            <button className={styles.btnKleinRood}
              style={{width:'100%', padding:'8px'}}
              onClick={() => verwijderVoorspelling(predMatch, null)}>
              🗑️ Beide verwijderen
            </button>
          )}
        </div>
      )}
    </div>
  )
}
