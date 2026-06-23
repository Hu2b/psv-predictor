import { useState, useEffect } from 'react'
import styles from './H2H.module.css'

export default function H2H({ thuisId, uitId }) {
  const [h2h, setH2h] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!thuisId || !uitId) { setLoading(false); return }
    async function laad() {
      try {
        const r = await fetch(`/api/h2h?home=${thuisId}&away=${uitId}`)
        const data = await r.json()
        setH2h(data.h2h || [])
      } catch (_) { setH2h([]) }
      finally { setLoading(false) }
    }
    laad()
  }, [thuisId, uitId])

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
      <h3 className={styles.titel}>Laatste ontmoetingen</h3>
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
