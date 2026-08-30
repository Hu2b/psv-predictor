import { useState, useEffect } from 'react'
import { zoekHistorischeOntmoetingen } from '../../shared/h2h-historisch.js'
import styles from './H2H.module.css'

export default function H2H({ matchId, thuis, uit }) {
  const [h2h, setH2h] = useState([])
  const [uitArchief, setUitArchief] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let gestopt = false

    // Vangnet: als de API geen (recente) onderlinge ontmoetingen kent —
    // bijv. duels uit de jaren 80 die niet in de database van
    // football-data.org zitten — valt de app terug op het handmatig
    // bijgehouden archief in shared/h2h-historisch.js.
    function valTerugOpArchief() {
      const archief = zoekHistorischeOntmoetingen(thuis, uit)
      if (!gestopt) {
        setH2h(archief.slice(0, 3))
        setUitArchief(archief.length > 0)
      }
    }

    setLoading(true)
    setUitArchief(false)

    if (!matchId) {
      valTerugOpArchief()
      setLoading(false)
      return () => { gestopt = true }
    }

    async function laad() {
      try {
        const r = await fetch(`/api/h2h?matchId=${matchId}`)
        const data = await r.json()
        if (gestopt) return
        if (data.h2h && data.h2h.length > 0) {
          setH2h(data.h2h)
          setUitArchief(false)
        } else {
          valTerugOpArchief()
        }
      } catch (_) {
        if (!gestopt) valTerugOpArchief()
      }
      finally { if (!gestopt) setLoading(false) }
    }
    laad()

    return () => { gestopt = true }
  }, [matchId, thuis, uit])

  if (loading) return (
    <div className={styles.card}>
      <div className={styles.loadRij}>
        <div className="spinner" style={{width:16,height:16}} />
        <span>H2H laden…</span>
      </div>
    </div>
  )

  if (!h2h.length) return null

  return (
    <div className={styles.card}>
      <h3 className={styles.titel}>{uitArchief ? 'Historische ontmoetingen' : 'Laatste ontmoetingen'}</h3>
      <div className={styles.lijst}>
        {h2h.map((m, i) => (
          <div key={i} className={styles.rij}>
            <div className={styles.meta}>
              <span className={styles.datum}>{m.datum}</span>
              <span className={styles.comp}>{m.competitie}</span>
            </div>
            <div className={styles.match}>
              <span className={styles.team}>{m.thuis}</span>
              <span className={styles.score}>{m.uitslag}</span>
              <span className={`${styles.team} ${styles.teamR}`}>{m.uit}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
