import { useState, useRef } from 'react'
import H2H from './H2H.jsx'
import PredictionForm from './PredictionForm.jsx'
import LiveScore from './LiveScore.jsx'
import { zoekLogo } from '../../shared/teams.js'
import styles from './NextMatch.module.css'

const COMP_LABELS = {
  JCS: 'Johan Cruijff Schaal',
  ERE: 'Eredivisie',
  KNVB: 'KNVB Beker',
  CL: 'Champions League',
  UL: 'UEFA League',
  VRI: 'Vriendschappelijk',
  LICHT: 'Lichtstadderby',
}

const SWIPE_DREMPEL = 50 // minimale swipe-afstand in pixels

function formatTijd(datumISO) {
  if (!datumISO) return ''
  const d = new Date(datumISO)
  return d.toLocaleTimeString('nl-NL', {
    timeZone: 'Europe/Amsterdam',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function NextMatch({ fixture, fixtures, speler }) {
  const [gekozenId, setGekozenId] = useState(null)
  const [randMelding, setRandMelding] = useState(null)
  const touchStartX = useRef(null)

  const alleWedstrijden = [...fixtures].sort((a, b) => new Date(a.datumISO) - new Date(b.datumISO))

  if (alleWedstrijden.length === 0) {
    return <div className={styles.leeg}><p>Geen PSV wedstrijden gevonden.</p></div>
  }

  // Bepaalt welke wedstrijd standaard getoond wordt bij het openen van de
  // app: 1) een wedstrijd die vandaag gepland staat (ongeacht status —
  // ook als hij al bezig/afgelopen is), 2) anders de eerstvolgende nog te
  // spelen wedstrijd (op datum, niet op status), 3) anders de laatste
  // wedstrijd in de lijst (bijv. als het seizoen al helemaal voorbij is).
  const nu = new Date()
  const vandaag = nu.toDateString()
  const standaard =
    alleWedstrijden.find(f => new Date(f.datumISO).toDateString() === vandaag) ||
    alleWedstrijden.find(f => new Date(f.datumISO) > nu) ||
    alleWedstrijden[alleWedstrijden.length - 1]

  const getoond = gekozenId !== null
    ? alleWedstrijden.find(f => String(f.matchId) === String(gekozenId)) || standaard
    : standaard

  const huidigeIndex = alleWedstrijden.findIndex(f => String(f.matchId) === String(getoond.matchId))

  function toonRandMelding(tekst) {
    setRandMelding(tekst)
    setTimeout(() => setRandMelding(null), 1500)
  }

  function gaNaarVolgende() {
    if (huidigeIndex === -1) return
    if (huidigeIndex >= alleWedstrijden.length - 1) {
      toonRandMelding('Dit is de laatste wedstrijd')
      return
    }
    setGekozenId(alleWedstrijden[huidigeIndex + 1].matchId)
  }

  function gaNaarVorige() {
    if (huidigeIndex === -1) return
    if (huidigeIndex <= 0) {
      toonRandMelding('Dit is de eerste wedstrijd')
      return
    }
    setGekozenId(alleWedstrijden[huidigeIndex - 1].matchId)
  }

  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX
  }

  function handleTouchEnd(e) {
    if (touchStartX.current === null) return
    const diff = e.changedTouches[0].clientX - touchStartX.current
    if (diff < -SWIPE_DREMPEL) {
      gaNaarVolgende() // swipe naar links → volgende wedstrijd (iPhone-standaard)
    } else if (diff > SWIPE_DREMPEL) {
      gaNaarVorige() // swipe naar rechts → vorige wedstrijd (iPhone-standaard)
    }
    touchStartX.current = null
  }

  const isAfgelopen = ['FT','AET','PEN'].includes(getoond.status)
  const isLive = ['1H','HT','2H','ET','BT','LIVE'].includes(getoond.status)

  return (
    <div className={styles.wrapper}>
      <div className={styles.selectorWrap}>
        <label className={styles.selectorLabel}>Wedstrijd</label>
        <select
          className={styles.selector}
          value={String(getoond.matchId)}
          onChange={e => {
            const val = e.target.value
            const match = alleWedstrijden.find(f => String(f.matchId) === String(val))
            setGekozenId(match ? match.matchId : null)
          }}
        >
          {alleWedstrijden.map(f => (
            <option key={f.matchId} value={String(f.matchId)}>
              #{f.volgnummer || '—'} {f.datum} — {f.thuis} vs {f.uit} ({f.competitie})
              {['FT','AET','PEN'].includes(f.status) ? ' ✓' : ''}
            </option>
          ))}
        </select>
      </div>

      <div
        className={styles.card}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {randMelding && (
          <div className={styles.randMelding}>{randMelding}</div>
        )}
        <div className={styles.compRow}>
          <span className={styles.compBadge}>{COMP_LABELS[getoond.competitie] || getoond.competitie}</span>
          <span className={styles.volgnr}>#{getoond.volgnummer || '—'}</span>
        </div>
        <div className={styles.datum}>
          {getoond.datum}
          <span className={styles.tijd}> · {formatTijd(getoond.datumISO)}</span>
        </div>
        <div className={styles.teams}>
          <div className={styles.team}>
            {getoond.thuisLogo ? (
              <img
                src={getoond.thuisLogo}
                alt=""
                className={styles.logo}
                onError={e => {
                  const fallback = zoekLogo(getoond.thuis)
                  if (fallback && e.target.src !== fallback) {
                    e.target.src = fallback
                  } else {
                    e.target.style.visibility = 'hidden'
                  }
                }}
              />
            ) : (
              <span className={styles.logo} />
            )}
            <span className={styles.teamCode}>{getoond.thuis}</span>
            <span className={styles.teamNaam}>{getoond.thuisNaam}</span>
          </div>
          <div className={styles.vsBlok}>
            {isAfgelopen ? (
              <div className={styles.eindstand}>
                <span className={styles.eindstandScore}>{getoond.uitslag?.home} – {getoond.uitslag?.away}</span>
                <span className={styles.eindstandLabel}>Eindstand</span>
              </div>
            ) : isLive ? (
              <div className={styles.liveBlok}>
                <span className={styles.liveDot} />
                <span className={styles.liveLabel}>LIVE</span>
              </div>
            ) : (
              <span className={styles.vs}>VS</span>
            )}
          </div>
          <div className={`${styles.team} ${styles.teamRight}`}>
            {getoond.uitLogo ? (
              <img
                src={getoond.uitLogo}
                alt=""
                className={styles.logo}
                onError={e => {
                  const fallback = zoekLogo(getoond.uit)
                  if (fallback && e.target.src !== fallback) {
                    e.target.src = fallback
                  } else {
                    e.target.style.visibility = 'hidden'
                  }
                }}
              />
            ) : (
              <span className={styles.logo} />
            )}
            <span className={styles.teamCode}>{getoond.uit}</span>
            <span className={styles.teamNaam}>{getoond.uitNaam}</span>
          </div>
        </div>
      </div>

      {isLive && <LiveScore fixture={getoond} />}
      <H2H thuisId={getoond.thuisId} uitId={getoond.uitId} />
      <PredictionForm fixture={getoond} speler={speler} />
    </div>
  )
}
