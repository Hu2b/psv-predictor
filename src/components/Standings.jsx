import { useState, useEffect } from 'react'
import styles from './Standings.module.css'

function bouwWhatsAppTekst(klassement, results, spelerNaamMap) {
  const regels = []
  regels.push('🏆 *PSV Poule — Klassement*')
  regels.push('')
  klassement.forEach((s, i) => {
    regels.push(`${i + 1}. ${s.naam}: *${s.punten}* punten`)
  })
  regels.push('')
  regels.push('_Alle wedstrijden:_')

  const gesorteerd = [...results].sort((a, b) => (a.volgnummer || 0) - (b.volgnummer || 0))
  for (const r of gesorteerd) {
    regels.push('')
    regels.push(`#${r.volgnummer || '—'} ${r.datum} — ${r.competitie}`)
    regels.push(`${r.thuis} ${r.uitslag.home}-${r.uitslag.away} ${r.uit}`)
    for (const [playerId, pred] of Object.entries(r.predicties || {})) {
      const naam = spelerNaamMap[playerId] || '???'
      const punten = r.punten?.[playerId] ?? 0
      const totaal = r.totalen?.[playerId] ?? '—'
      if (pred) {
        regels.push(`${naam}: ${pred.home}-${pred.away} (+${punten}pt) — Totaal: ${totaal}`)
      } else {
        regels.push(`${naam}: geen voorspelling (+0pt) — Totaal: ${totaal}`)
      }
    }
  }

  return regels.join('\n')
}

export default function Standings({ fixtures, speler }) {
  const [totals, setTotals] = useState({})
  const [results, setResults] = useState([])
  const [spelerNaamMap, setSpelerNaamMap] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function laad() {
      try {
        const [rResults, rSpelers] = await Promise.all([
          fetch('/api/results?all=1'),
          fetch('/api/players'),
        ])
        const dataResults = await rResults.json()
        const dataSpelers = await rSpelers.json()

        setTotals(dataResults.totals || {})
        setResults(dataResults.results || [])

        const map = {}
        for (const s of dataSpelers.spelers || []) map[s.id] = s.naam
        setSpelerNaamMap(map)
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

  const klassement = Object.entries(totals)
    .map(([playerId, punten]) => ({ playerId, naam: spelerNaamMap[playerId] || '???', punten }))
    .sort((a, b) => b.punten - a.punten)

  function handleDelen() {
    const tekst = bouwWhatsAppTekst(klassement, results, spelerNaamMap)
    const url = `https://wa.me/?text=${encodeURIComponent(tekst)}`
    window.open(url, '_blank')
  }

  if (loading) return (
    <div className={styles.loadState}>
      <div className="spinner" />
      <p>Resultaten laden…</p>
    </div>
  )

  const gesorteerdeResultaten = [...results].sort((a, b) => (b.volgnummer || 0) - (a.volgnummer || 0))

  return (
    <div className={styles.wrapper}>
      <div className={styles.klassement}>
        <h2 className={styles.klassementTitel}>Klassement</h2>
        {klassement.length === 0 ? (
          <p className={styles.geenData}>Nog geen punten gescoord</p>
        ) : (
          <div className={styles.ranglijst}>
            {klassement.map((s, i) => (
              <div
                key={s.playerId}
                className={`${styles.ranglijstRij} ${i === 0 ? styles.leider : ''} ${s.naam === speler ? styles.jezelf : ''}`}
              >
                <span className={styles.ranglijstPositie}>{i + 1}</span>
                <span className={styles.ranglijstNaam}>{s.naam}</span>
                {i === 0 && <span className={styles.kroon}>👑</span>}
                <span className={styles.ranglijstPunt}>{s.punten}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {results.length > 0 && (
        <button className={styles.deelBtn} onClick={handleDelen}>
          📤 Delen via WhatsApp
        </button>
      )}

      {results.length > 0 && (
        <div className={styles.resultatenWrapper}>
          <h3 className={styles.resultTitel}>Alle wedstrijden</h3>
          <div className={styles.resultLijst}>
            {gesorteerdeResultaten.map(r => (
              <div key={r.matchId} className={styles.resultKaart}>
                <div className={styles.wedstrijdMeta}>
                  <span className={styles.compTag}>{r.competitie}</span>
                  <span className={styles.wedstrijdDatum}>#{r.volgnummer || '—'} · {r.datum}</span>
                </div>
                <div className={styles.wedstrijdTeams}>
                  <span className={styles.teamCode}>{r.thuis}</span>
                  <span className={styles.uitslag}>{r.uitslag.home}–{r.uitslag.away}</span>
                  <span className={styles.teamCode}>{r.uit}</span>
                </div>
                <div className={styles.spelerTabel}>
                  <div className={styles.spelerTabelHeader}>
                    <span>Speler</span>
                    <span>Voorspelling</span>
                    <span>Punten</span>
                    <span>Totaal</span>
                  </div>
                  {Object.entries(r.predicties || {}).map(([playerId, pred]) => (
                    <div key={playerId} className={styles.spelerTabelRij}>
                      <span className={styles.spelerTabelNaam}>{spelerNaamMap[playerId] || '???'}</span>
                      {pred ? (
                        <span className={styles.predScore}>{pred.home}–{pred.away}</span>
                      ) : (
                        <span className={styles.predLeeg}>geen voorspelling</span>
                      )}
                      <span className={`${styles.punt} ${puntKleur(r.punten?.[playerId] ?? 0)}`}>+{r.punten?.[playerId] ?? 0}</span>
                      <span className={styles.lopendTotaal}>{r.totalen?.[playerId] ?? '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
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
