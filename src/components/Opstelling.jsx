import { useState, useEffect, useRef } from 'react'
import styles from './Opstelling.module.css'

// Toont de opstellingen van beide ploegen. Standaard ingeklapt tot één regel,
// want op een telefoon is het wedstrijdscherm al vol; pas na een tik wordt er
// opgehaald én uitgeklapt.
//
// Clubs maken hun opstelling doorgaans ongeveer een uur voor de aftrap bekend.
// Daarvóór levert de bron niets, en dan zegt dit blok dat ook gewoon in plaats
// van leeg te blijven — anders lijkt het alsof er iets stuk is.
export default function Opstelling({ matchId, datumISO }) {
  const [open, setOpen] = useState(false)
  const [laden, setLaden] = useState(false)
  const [opstellingen, setOpstellingen] = useState(null)
  const [definitief, setDefinitief] = useState(false)
  const [status, setStatus] = useState('voor')
  const [bijgewerkt, setBijgewerkt] = useState(null)

  // Welke wedstrijd nu in beeld staat. Een antwoord dat binnenkomt nadat er al
  // doorgeswipet is, hoort niet meer getoond te worden — anders zie je de
  // opstelling van de ene wedstrijd bij de andere staan.
  const huidige = useRef(matchId)

  // `stil` onderdrukt de laadmelding. Bij het automatisch bijwerken wil je
  // niet elke minuut "Laden…" over je scherm zien flitsen; het blok hoort dan
  // gewoon stil te blijven staan tot er echt iets verandert.
  async function laad({ stil = false } = {}) {
    const voor = matchId
    if (!stil) setLaden(true)
    try {
      const r = await fetch(`/api/opstelling?matchId=${voor}`)
      const data = await r.json()
      if (huidige.current !== voor) return
      setOpstellingen(data.opstellingen || [])
      setDefinitief(Boolean(data.definitief))
      setStatus(data.status || 'voor')
      setBijgewerkt(new Date())
    } catch (_) {
      if (huidige.current !== voor) return
      if (!stil) setOpstellingen([])
    } finally {
      if (huidige.current === voor && !stil) setLaden(false)
    }
  }

  // Swipen naar een andere wedstrijd betekent een andere opstelling. Stond het
  // blok open, dan blijft het open en wordt de nieuwe meteen opgehaald; wat er
  // nog stond wordt eerst gewist, zodat er geen moment de verkeerde elf staat.
  useEffect(() => {
    huidige.current = matchId
    setOpstellingen(null)
    setDefinitief(false)
    setStatus('voor')
    setBijgewerkt(null)
    if (open) laad()
  }, [matchId])

  // Zolang dit blok openstaat en de wedstrijd niet is afgelopen, wordt er elke
  // minuut bijgewerkt. Vóór de aftrap om te zien of de opgegeven elf nog
  // wijzigt, tijdens de wedstrijd om de wissels binnen te krijgen.
  //
  // Het begint twee uur voor de aftrap — clubs geven hun opstelling ongeveer
  // een uur van tevoren vrij, dus dat is ruim op tijd — en stopt drie uur na de
  // aftrap sowieso, zodat een vergeten tabblad niet eindeloos blijft pollen.
  //
  // Deze hook staat bewust vóór de `if (!open)` hieronder. React eist dat
  // hooks bij elke render in dezelfde volgorde worden aangeroepen, en een
  // vroege return ertussen breekt dat.
  useEffect(() => {
    if (!open || status === 'afgelopen' || !datumISO) return undefined

    const timer = setInterval(() => {
      const minutenTotAftrap = (new Date(datumISO) - new Date()) / 60000
      if (minutenTotAftrap <= 120 && minutenTotAftrap > -180) laad({ stil: true })
    }, 60 * 1000)

    return () => clearInterval(timer)
  }, [open, status, matchId, datumISO])

  function openen() {
    setOpen(true)
    laad()
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

      {!laden && opstellingen?.length === 0 && status === 'voor' && (
        <p className={styles.leeg}>
          Nog niet bekend. Clubs geven hun opstelling meestal ongeveer een uur
          voor de aftrap vrij. Laat dit blok openstaan, dan verschijnt hij
          vanzelf zodra hij er is.
        </p>
      )}

      {!laden && opstellingen?.length === 0 && status !== 'voor' && (
        <p className={styles.leeg}>
          Van deze wedstrijd heeft de bron geen opstelling. Dat komt bij oudere
          wedstrijden en bij bekerduels wel eens voor.
        </p>
      )}

      {!laden && opstellingen?.length > 0 && (
        <p className={definitief ? styles.definitief : styles.voorlopig}>
          {status === 'voor' && '⏳ Opgegeven opstelling — kan tot de aftrap nog wijzigen'}
          {status === 'bezig' && '🔴 Wedstrijd bezig — wissels komen er vanzelf bij'}
          {status === 'afgelopen' && '✅ Definitieve opstelling'}
          {status !== 'afgelopen' && bijgewerkt && (
            <span className={styles.bijgewerkt}>
              {' '}· bijgewerkt {bijgewerkt.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
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
                    <span className={styles.positie}>
                      {s.gewisseld && s.minuut ? `↓ ${s.minuut}` : s.positie}
                    </span>
                  </div>
                ))}
              </div>

              {ploeg.wissels?.length > 0 && (
                <>
                  <div className={styles.bankKop}>Wissels</div>
                  <div className={styles.wissels}>
                    {ploeg.wissels.map(w => (
                      <div key={`${w.minuut}-${w.erin}`} className={styles.wissel}>
                        <span className={styles.wisselMinuut}>{w.minuut}</span>
                        <span className={styles.wisselNamen}>
                          <span className={styles.erin}>▲ {w.erin}</span>
                          {' '}
                          <span className={styles.eruit}>▼ {w.eruit}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {ploeg.bank.length > 0 && (
                <>
                  <div className={styles.bankKop}>Bank</div>
                  <div className={styles.bank}>
                    {ploeg.bank.filter(s => !s.ingevallen).map(s => s.naam).join(' · ') || '—'}
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
