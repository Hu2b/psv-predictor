import { useState, useEffect } from 'react'
import styles from './Standings.module.css'

export default function Standings({ fixtures, speler }) {
  const [totals, setTotals] = useState({ niek: 0, huub: 0 })
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function laad() {
      try {
        const r = await fetch('/api/results?all=1')
        const data = await r.json()
        setTotals(data.totals || { niek: 0, huub: 0 })
        setResults(data.results || [])
      } catch (_) {}
      finally { setLoading(false) }
    }
    laad()
  }, [])

  function puntKleur(punt) {
    if (punt >= 10) return styles.puntGoud
    if (punt >= 7)  return styles.puntGroen
    if (punt >= 5)  return styles.puntBlauw
    return styles.puntNul
  }

  const niekLeidt = totals.niek > totals.huub
  const huubLeidt = totals.huub > totals.niek

  if (loading) return (
    <div className={styles.loadState}>
      <div className="spinner" />
      <p>Resultaten laden…</p>
    </div>
  )

  return (
    <div className={styles.wrapper}>
      <div className={styles.klassement}>
        <h2 className={styles.klassementTitel}>Klassement</h2>
        <div className={styles.scores}>
          <div className={`${styles.spelerScore} ${niekLeidt ? styles.leider : ''}`}>
            <span className={styles.spelerNaam}>Niek</span>
            <span className={styles.spelerPunt}>{totals.niek}</span>
            {niekLeidt && <span className={styles.kroon}>👑</span>}
          </div>
          <div className={styles.scheidingV}>vs</div>
          <div className={`${styles.spelerScore} ${huubLeidt ? styles.leider : ''}`}>
            <span className={styles.spelerNaam}>Huub</span>
            <span className={styles.spelerPunt}>{totals.huub}</span>
            {huubLeidt && <span className={styles.kroon}>👑</span>}
          </div>
        </div>
        {totals.niek === 0 && totals.huub === 0 && (
          <p className={styles.geenData}>Nog geen punten gescoord</p>
        )}
      </div>

      {results.length > 0 && (
        <div className={styles.resultaten}>
          <h3 className={styles.resultTitel}>Alle wedstrijden</h3>
          <div className={styles.resultHeader}>
            <span className={styles.colWedstrijd}>Wedstrijd</span>
            <span className={styles.colSpeler}>Niek</span>
            <span className={styles.colSpeler}>Huub</span>
          </div>
          {results.map(r => (
            <div key={r.matchId} className={styles.resultRij}>
              <div className={styles.wedstrijdInfo}>
                <div className={styles.wedstrijdMeta}>
                  <span className={styles.compTag}>{r.competitie}</span>
                  <span className={styles.wedstrijdDatum}>{r.datum}</span>
                </div>
                <div className={styles.wedstrijdTeams}>
                  <span className={styles.teamCode}>{r.thuis}</span>
                  <span className={styles.uitslag}>{r.uitslag.home}–{r.uitslag.away}</span>
                  <span className={styles.teamCode}>{r.uit}</span>
                </div>
              </div>
              <div className={styles.spelerResultaat}>
                <span className={styles.predScore}>{r.predNiek ? `${r.predNiek.home}–${r.predNiek.away}` : '–'}</span>
                <span className={`${styles.punt} ${puntKleur(r.puntNiek)}`}>+{r.puntNiek}</span>
                <span className={styles.lopendTotaal}>{r.totaalNiek}</span>
              </div>
              <div className={styles.spelerResultaat}>
                <span className={styles.predScore}>{r.predHuub ? `${r.predHuub.home}–${r.predHuub.away}` : '–'}</span>
                <span className={`${styles.punt} ${puntKleur(r.puntHuub)}`}>+{r.puntHuub}</span>
                <span className={styles.lopendTotaal}>{r.totaalHuub}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {results.length === 0 && (
        <div className={styles.leeg}>
          <p>Nog geen wedstrijdresultaten.</p>
          <p className={styles.leegSub}>Na elke wedstrijd verschijnen hier de punten.</p>
        </div>
      )}
    </div>
  )
}
