import { useState, useEffect } from 'react'
import styles from './Admin.module.css'

const SESSION_KEY = 'psv_session_token'

export default function AdminSpelers({ setMelding }) {
  const [spelers, setSpelers] = useState([])
  const [laden, setLaden] = useState(true)

  useEffect(() => {
    laadSpelers()
  }, [])

  async function laadSpelers() {
    setLaden(true)
    try {
      const sessionToken = localStorage.getItem(SESSION_KEY)
      const r = await fetch(`/api/admin-players?sessionToken=${encodeURIComponent(sessionToken)}`)
      const data = await r.json()
      if (data.spelers) setSpelers(data.spelers)
    } catch (_) {}
    setLaden(false)
  }

  async function vraagActieAan(actie, speler) {
    const adminPincode = window.prompt(
      `Voer je eigen pincode in om te bevestigen: ${actie === 'verwijderen' ? 'verwijderen van' : 'pincode resetten van'} ${speler.naam}`
    )
    if (!adminPincode) return

    const sessionToken = localStorage.getItem(SESSION_KEY)
    try {
      const r = await fetch('/api/admin-players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: actie, sessionToken, adminPincode, playerId: speler.id })
      })
      const data = await r.json()
      if (data.success) {
        setMelding({ type: 'ok', tekst: data.message })
        await laadSpelers()
      } else {
        setMelding({ type: 'fout', tekst: data.error })
      }
    } catch (e) {
      setMelding({ type: 'fout', tekst: 'Er ging iets mis. Probeer het opnieuw.' })
    }
  }

  if (laden) return <p className={styles.leegTekst}>Spelers laden…</p>

  return (
    <div className={styles.sectie}>
      <label className={styles.label}>Spelersbeheer</label>
      {spelers.length === 0 && <p className={styles.leegTekst}>Geen spelers gevonden</p>}
      {spelers.map(s => (
        <div key={s.id} className={styles.beheerRij}>
          <div className={styles.beheerInfo}>
            <span className={styles.beheerNaam}>
              {s.naam} {s.isAdmin && '👑'} {!s.geverifieerd && '(niet geverifieerd)'}
            </span>
            <span className={styles.leegTekst} style={{ fontSize: 12 }}>{s.email}</span>
          </div>
          <div className={styles.beheerBtns}>
            <button className={styles.btnKlein} onClick={() => vraagActieAan('reset-pincode', s)}>
              🔑 Pincode resetten
            </button>
            <button className={styles.btnKleinRood} onClick={() => vraagActieAan('verwijderen', s)}>
              🗑️ Verwijderen
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
