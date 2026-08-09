import { useState, useEffect } from 'react'
import styles from './LiveScore.module.css'

// Puur een weergavecomponent. Het wegschrijven van de eindstand gebeurt
// server-side (api/cron-uitslagen.js en api/fixtures.js). Dat zat hier
// vroeger als POST naar /api/results, maar dat pad kon per definitie niet
// werken: NextMatch rendert deze component alleen zolang de wedstrijd LIVE
// is, dus zodra de status op FT sprong verdween de component juist voordat
// hij de eindstand kon versturen. Bijkomend voordeel: de client hoeft geen
// uitslagen meer te kunnen schrijven.
export default function LiveScore({ fixture }) {
  const [liveData, setLiveData] = useState(null)

  const isLive = ['1H','HT','2H','ET','BT','LIVE'].includes(fixture.status)
  const isAfgelopen = ['FT','AET','PEN'].includes(fixture.status)

  useEffect(() => {
    let gestopt = false

    async function haalScore() {
      try {
        const r = await fetch(`/api/livescore?matchId=${fixture.matchId}`)
        const data = await r.json()
        if (!gestopt) setLiveData(data)
      } catch (_) {}
    }

    haalScore()
    if (isLive) {
      const interval = setInterval(haalScore, 120000)
      return () => { gestopt = true; clearInterval(interval) }
    }
    return () => { gestopt = true }
  }, [fixture.matchId, isLive])

  if (!liveData?.score) return null

  const score = liveData.score

  return (
    <div className={`${styles.card} ${isLive ? styles.liveCard : ''}`}>
      {isLive && (
        <div className={styles.liveHeader}>
          <span className={styles.liveDot} />
          <span className={styles.liveText}>LIVE</span>
          {liveData.minuut && <span className={styles.minuut}>{liveData.minuut}'</span>}
        </div>
      )}
      {isAfgelopen && <div className={styles.ftHeader}>EINDSTAND</div>}
      <div className={styles.scoreRij}>
        <span className={styles.team}>{fixture.thuis}</span>
        <span className={styles.score}>{score.home} – {score.away}</span>
        <span className={`${styles.team} ${styles.teamR}`}>{fixture.uit}</span>
      </div>
    </div>
  )
}
