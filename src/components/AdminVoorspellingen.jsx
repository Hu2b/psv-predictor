import { useState } from 'react'
import styles from './Admin.module.css'
import { getSessionToken } from '../lib/sessie.js'

export default function AdminVoorspellingen({ alleWedstrijden, setMelding }) {
  const [predMatch, setPredMatch] = useState('')
  const [predicties, setPredicties] = useState([])
  const [predInputs, setPredInputs] = useState({})
  const [predLaden, setPredLaden] = useState(false)
  const [onthuld, setOnthuld] = useState(true)
  const [bezigId, setBezigId] = useState(null)

  async function laadVoorspellingen(matchId) {
    setPredLaden(true)
    try {
      const sessionToken = getSessionToken()
      const r = await fetch(`/api/admin?action=voorspellingen&matchId=${matchId}&sessionToken=${encodeURIComponent(sessionToken)}`)
      const data = await r.json()
      const lijst = data.predicties || []
      setPredicties(lijst)
      setOnthuld(data.onthuld ?? true)
      // Invoervelden vullen met de zichtbare huidige waarden (verborgen scores
      // blijven leeg, zodat ze niet vroegtijdig uitlekken).
      const inputs = {}
      for (const p of lijst) {
        inputs[p.playerId] = {
          home: p.home != null ? String(p.home) : '',
          away: p.away != null ? String(p.away) : '',
        }
      }
      setPredInputs(inputs)
    } catch (_) {}
    setPredLaden(false)
  }

  function setInput(playerId, veld, waarde) {
    setPredInputs(prev => ({ ...prev, [playerId]: { ...prev[playerId], [veld]: waarde } }))
  }

  async function opslaanVoorspelling(playerId) {
    const inv = predInputs[playerId] || {}
    if (inv.home === '' || inv.away === '') {
      setMelding({ type: 'fout', tekst: 'Vul beide scores in' })
      return
    }
    setBezigId(playerId)
    try {
      const r = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'zetVoorspelling', sessionToken: getSessionToken(),
          matchId: predMatch, playerId,
          home: Number(inv.home), away: Number(inv.away),
        })
      })
      const data = await r.json()
      if (data.success) {
        setMelding({ type: 'ok', tekst: 'Voorspelling opgeslagen' })
        await laadVoorspellingen(predMatch)
      } else {
        setMelding({ type: 'fout', tekst: data.error || 'Opslaan mislukt' })
      }
    } catch (_) {
      setMelding({ type: 'fout', tekst: 'Netwerkfout' })
    }
    setBezigId(null)
  }

  async function verwijderVoorspelling(matchId, playerId) {
    const r = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verwijderVoorspelling', sessionToken: getSessionToken(), matchId, playerId })
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
        <p className={styles.leegTekst}>Geen geverifieerde spelers gevonden</p>
      )}

      {!predLaden && predicties.length > 0 && (
        <div className={styles.predBlok}>
          {!onthuld && (
            <p className={styles.leegTekst}>
              🔒 De aftrap is nog niet geweest en niet iedereen heeft voorspeld — bestaande scores van anderen zijn verborgen. Je kunt hieronder wel een voorspelling invoeren of overschrijven.
            </p>
          )}
          {predicties.map(p => (
            <div key={p.playerId} className={styles.predRij}>
              <div className={styles.predInfo}>
                <span className={styles.predNaam}>{p.naam}</span>
                {p.verborgen && <span className={styles.predScore}>*****</span>}
                {p.doorBeheerder && <span className={styles.beheerderTag}>beheerder</span>}
                {!p.heeftVoorspelling && <span className={styles.predLeeg}>nog geen</span>}
              </div>
              <div className={styles.predInvoer}>
                <input type="number" min="0" max="99" className={styles.predScoreInput}
                  value={predInputs[p.playerId]?.home ?? ''} inputMode="numeric"
                  placeholder={p.verborgen ? '•' : '0'}
                  onChange={e => setInput(p.playerId, 'home', e.target.value)} />
                <span className={styles.predDash}>-</span>
                <input type="number" min="0" max="99" className={styles.predScoreInput}
                  value={predInputs[p.playerId]?.away ?? ''} inputMode="numeric"
                  placeholder={p.verborgen ? '•' : '0'}
                  onChange={e => setInput(p.playerId, 'away', e.target.value)} />
                <button className={styles.btnKlein} disabled={bezigId === p.playerId}
                  onClick={() => opslaanVoorspelling(p.playerId)}>
                  {bezigId === p.playerId ? '…' : 'Opslaan'}
                </button>
                {p.heeftVoorspelling && (
                  <button className={styles.btnKleinRood}
                    onClick={() => verwijderVoorspelling(predMatch, p.playerId)}>🗑️</button>
                )}
              </div>
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
