import { useState, useEffect } from 'react'
import styles from './AdminSpelers.module.css'
import PincodeBevestigModal from './PincodeBevestigModal.jsx'

const SESSION_KEY = 'psv_session_token'

export default function AdminSpelers({ setMelding }) {
  const [spelers, setSpelers] = useState([])
  const [laden, setLaden] = useState(true)
  const [actieBezig, setActieBezig] = useState(false)
  const [modalActie, setModalActie] = useState(null)

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

  function openModal(actie, speler) {
    setModalActie({ actie, speler })
  }

  function sluitModal() {
    setModalActie(null)
  }

  async function bevestigActie(adminPincode) {
    if (!modalActie) return
    setActieBezig(true)
    const { actie, speler } = modalActie
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
        setModalActie(null)
        await laadSpelers()
      } else {
        setMelding({ type: 'fout', tekst: data.error })
      }
    } catch (e) {
      setMelding({ type: 'fout', tekst: 'Er ging iets mis. Probeer het opnieuw.' })
    } finally {
      setActieBezig(false)
    }
  }

  if (laden) return <p className={styles.leegTekst}>Spelers laden…</p>

  return (
    <div className={styles.wrapper}>
      <label className={styles.label}>Spelersbeheer</label>
      {spelers.length === 0 && <p className={styles.leegTekst}>Geen spelers gevonden</p>}

      <div className={styles.lijst}>
        {spelers.map(s => (
          <div key={s.id} className={styles.kaart}>
            <div className={styles.info}>
              <div className={styles.naamRij}>
                <span className={styles.naam}>{s.naam} {s.isAdmin && '👑'}</span>
                {!s.geverifieerd && <span className={styles.badge}>niet geverifieerd</span>}
              </div>
              <span className={styles.email}>{s.email}</span>
            </div>
            <div className={styles.btnKolom}>
              <button className={styles.btnResetten} onClick={() => openModal('reset-pincode', s)}>
                🔑 Pincode resetten
              </button>
              <button className={styles.btnVerwijderen} onClick={() => openModal('verwijderen', s)}>
                🗑️ Verwijderen
              </button>
            </div>
          </div>
        ))}
      </div>

      {modalActie && (
        <PincodeBevestigModal
          titel={modalActie.actie === 'verwijderen' ? 'Speler verwijderen' : 'Pincode resetten'}
          omschrijving={
            modalActie.actie === 'verwijderen'
              ? `Weet je zeker dat je "${modalActie.speler.naam}" wilt verwijderen? Al zijn voorspellingen en punten worden ook verwijderd. Voer je eigen pincode in om te bevestigen.`
              : `Er wordt een nieuwe pincode gegenereerd voor "${modalActie.speler.naam}" en per e-mail verstuurd. Voer je eigen pincode in om te bevestigen.`
          }
          laden={actieBezig}
          onBevestig={bevestigActie}
          onAnnuleer={sluitModal}
        />
      )}
    </div>
  )
}
