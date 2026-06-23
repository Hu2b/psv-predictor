import { useState, useEffect } from 'react'
import styles from './LiveScore.module.css'

export default function LiveScore({ fixture }) {
  const [liveData, setLiveData] = useState(null)
  const [resultVerwerkt, setResultVerwerkt] = useState(false)

  const isLive = ['1H','HT','2H','ET','BT','LIVE'].includes(fixture.status)
  const isAfgelopen = ['FT','AET','PEN'].includes(fixture.status)

  useEffect(() => {
    async function haalScore() {
      try {
        const r = await fetch(`/api/livescore?matchId=${fixture.matchId}`)
        const data = await r.json()
        setLiveData(data)
        if (data.isAfgelopen && data.score && !resultVerwerkt) {
          await verwerkResultaat(data.score)
          setResultVerwerkt(true)
        }
      } catch (_) {}
    }

    async function verwerkResultaat(score) {
      try {
        await fetch('/api/results', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            matchId: fixture.matchId,
            homeScore: score.home,
            awayScore: score.away,
            matchInfo: {
              datumISO: fixture.datumISO,
              datum: fixture.datum,
              competitie: fixture.competitie,
              thuis: fixture.thuis,
              uit: fixture.uit,
            }
          })
        })
      } catch (_) {}
    }

    haalScore()
    if (isLive) {
      const interval = setInterval(haalScore, 120000)
      return () => clearInterval(interval)
    }
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
