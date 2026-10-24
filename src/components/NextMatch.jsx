import { useState, useRef, useEffect } from 'react'
import H2H from './H2H.jsx'
import Opstelling from './Opstelling.jsx'
import PredictionForm from './PredictionForm.jsx'
import LiveScore from './LiveScore.jsx'
import { zoekLogo } from '../../shared/teams.js'
import { COMP_LABELS } from '../../shared/competities.js'
import styles from './NextMatch.module.css'

const SWIPE_DREMPEL = 50 // minimale swipe-afstand in pixels

// Hetzelfde gebaar op een trackpad of Magic Mouse komt binnen als wheel-events
// met een horizontale component. Die vuren tientallen keren per veeg (en daarna
// nog even na door de uitloop), dus er is een drempel nodig én een slot: één
// veeg hoort één wedstrijd op te schuiven, niet tien.
const WIEL_DREMPEL = 60    // opgetelde horizontale afstand voor één stap
const WIEL_RUST_MS = 250   // zo lang stilte betekent: het gebaar is voorbij

function formatTijd(datumISO) {
  if (!datumISO) return ''
  const d = new Date(datumISO)
  return d.toLocaleTimeString('nl-NL', {
    timeZone: 'Europe/Amsterdam',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// `startWedstrijd` komt van een rechtstreekse link (/w/12345), zoals in de
// herinnering kort voor de aftrap. Die opent niet alleen die wedstrijd, maar
// klapt ook de opstelling meteen uit — dat is precies waar zo'n link voor
// bedoeld is.
export default function NextMatch({ fixture, fixtures, speler, startWedstrijd = null }) {
  const [gekozenId, setGekozenId] = useState(startWedstrijd)
  const [randMelding, setRandMelding] = useState(null)
  const [onthuld, setOnthuld] = useState(false)
  const touchStartX = useRef(null)
  const kaartRef = useRef(null)

  // Vangnet voor als de link pas bekend is nadat dit scherm al staat (je moest
  // bijvoorbeeld eerst inloggen).
  useEffect(() => {
    if (startWedstrijd) setGekozenId(startWedstrijd)
  }, [startWedstrijd])

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

  // Trackpad en Magic Mouse. Bewust een eigen listener in plaats van onWheel:
  // React hangt wheel-events passief op, en dan werkt preventDefault() niet.
  // Dat is hier nodig, anders pakt de browser de horizontale veeg op als
  // "ga terug in de geschiedenis" en val je uit de app.
  useEffect(() => {
    const kaart = kaartRef.current
    if (!kaart) return undefined

    let opgeteld = 0
    let vergrendeld = false
    let rustTimer = null

    function afhandelen(e) {
      // Verticaal scrollen met rust laten: alleen een duidelijk horizontale
      // beweging telt als veeg.
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return
      e.preventDefault()

      clearTimeout(rustTimer)
      rustTimer = setTimeout(() => { opgeteld = 0; vergrendeld = false }, WIEL_RUST_MS)

      if (vergrendeld) return
      opgeteld += e.deltaX
      if (opgeteld > WIEL_DREMPEL) {
        vergrendeld = true
        gaNaarVolgende() // naar links vegen → verder in de lijst
      } else if (opgeteld < -WIEL_DREMPEL) {
        vergrendeld = true
        gaNaarVorige()
      }
    }

    kaart.addEventListener('wheel', afhandelen, { passive: false })
    return () => {
      clearTimeout(rustTimer)
      kaart.removeEventListener('wheel', afhandelen)
    }
  }, [huidigeIndex, alleWedstrijden])

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

  // "Laatste ontmoetingen" (H2H) alleen tonen bij een nog te spelen wedstrijd
  // waarvan de voorspellingen nog verborgen zijn. Zodra de aftrap voorbij is
  // óf iedereen heeft voorspeld (onthuld, gemeld door PredictionForm), verdwijnt
  // dit blok — dan verschijnen de eindstand/andere voorspellingen en zou het
  // geheel anders niet meer op één iPhone-scherm passen.
  const kickoffVoorbij = getoond.datumISO ? new Date(getoond.datumISO) <= nu : false
  const toonH2H = !kickoffVoorbij && !onthuld

  // Vanaf een dag voor de aftrap staat het linkje er, zodat je zelf kunt gaan
  // kijken zodra de opstelling bekend is (meestal zo'n uur van tevoren). Is hij
  // er nog niet, dan zegt het blok dat; laat je het openstaan, dan verschijnt
  // hij vanzelf. Na de wedstrijd blijft het linkje staan om terug te kijken.
  const urenTotAftrap = getoond.datumISO
    ? (new Date(getoond.datumISO) - nu) / (60 * 60 * 1000)
    : null
  const toonOpstelling = urenTotAftrap !== null && urenTotAftrap < 24

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
        ref={kaartRef}
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
      {toonOpstelling && (
        <Opstelling
          matchId={getoond.matchId}
          datumISO={getoond.datumISO}
          standaardOpen={String(getoond.matchId) === String(startWedstrijd)}
        />
      )}
      {toonH2H && <H2H matchId={getoond.matchId} thuis={getoond.thuis} uit={getoond.uit} />}
      <PredictionForm fixture={getoond} speler={speler} onOnthuld={setOnthuld} />
    </div>
  )
}
