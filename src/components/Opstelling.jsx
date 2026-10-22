import { useState } from 'react'
import styles from './Opstelling.module.css'

// Toont de opstellingen van beide ploegen. Standaard ingeklapt tot één regel,
// want op een telefoon is het wedstrijdscherm al vol; pas na een tik wordt er
// opgehaald én uitgeklapt.
//
// Clubs maken hun opstelling doorgaans ongeveer een uur voor de aftrap bekend.
// Daarvóór levert de bron niets, en dan zegt dit blok dat ook gewoon in plaats
// van leeg te blijven — anders lijkt het alsof er iets stuk is.
export default function Opstelling({ matchId }) {
  const [open, setOpen] = useState(false)
  const [laden, setLaden] = useState(false)
  const [opstellingen, setOpstellingen] = useState(null)

  async function openen() {
    setOpen(true)
    if (opstellingen !== null) return

    setLaden(true)
    try {
      const r = await fetch(`/api/opstelling?matchId=${matchId}`)
      const data = await r.json()
      setOpstellingen(data.opstellingen || [])
    } catch (_) {
      setOpstellingen([])
    }
    setLaden(false)
  }

  if (!open) {
    return (
      <button className={styles.link} onClick={openen}>
        Opstelling ›
      </button>
    )
  }

  return (
    <div className={styles.card}>
      <div className={styles.kop}>
        <span className={styles.titel}>Opstelling</span>
        <button className={styles.sluit} onClick={() => setOpen(false)}>sluiten ✕</button>
      </div>

      {laden && <p className={styles.leeg}>Laden…</p>}

      {!laden && opstellingen?.length === 0 && (
        <p className={styles.leeg}>
          Nog niet bekend. Clubs geven hun opstelling meestal ongeveer een uur
          voor de aftrap vrij — probeer het dan opnieuw.
        </p>
      )}

      {!laden && opstellingen?.length > 0 && (
        <div className={styles.ploegen}>
          {opstellingen.map(ploeg => (
            <div key={ploeg.team} className={styles.ploeg}>
              <div className={styles.ploegKop}>
                {ploeg.logo && <img className={styles.ploegLogo} src={ploeg.logo} alt="" />}
                <span className={styles.ploegNaam}>{ploeg.team}</span>
                {ploeg.formatie && <span className={styles.formatie}>{ploeg.formatie}</span>}
              </div>

              <div className={styles.spelers}>
                {ploeg.basis.map(s => (
                  <div
                    key={`${s.rugnummer}-${s.naam}`}
                    className={`${styles.speler} ${s.gewisseld ? styles.gewisseld : ''}`}
                  >
                    <span className={styles.rugnummer}>{s.rugnummer}</span>
                    <span className={styles.naam}>{s.naam}</span>
                    <span className={styles.positie}>{s.positie}</span>
                  </div>
                ))}
              </div>

              {ploeg.bank.length > 0 && (
                <>
                  <div className={styles.bankKop}>Bank</div>
                  <div className={styles.bank}>
                    {ploeg.bank.map(s => s.naam).join(' · ')}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
