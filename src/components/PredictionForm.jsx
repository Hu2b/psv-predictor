import { useState, useEffect } from 'react'
import styles from './PredictionForm.module.css'

export default function PredictionForm({ fixture, speler }) {
  const [homeScore, setHomeScore] = useState('')
  const [awayScore, setAwayScore] = useState('')
  const [status, setStatus] = useState('idle')
  const [mijnPred, setMijnPred] = useState(null)
  const [anderePredicties, setAnderePredicties] = useState([])
  const [onthuld, setOnthuld] = useState(false)
  const [aantalVoorspeld, setAantalVoorspeld] = useState(0)
  const [totaalSpelers, setTotaalSpelers] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')
  const [wijzigenModus, setWijzigenModus] = useState(false)

  const isAfgelopen = ['FT','AET','PEN'].includes(fixture.status)
  const isBezig = ['1H','HT','2H','ET','BT','LIVE'].includes(fixture.status)
  const isSluiting = isAfgelopen || isBezig

  async function laad() {
    try {
      const r = await fetch(`/api/prediction?matchId=${fixture.matchId}&playerId=${speler.id}&datumISO=${encodeURIComponent(fixture.datumISO)}`)
      const data = await r.json()

      if (data.mijnPrediction?.confirmed) {
        setMijnPred(data.mijnPrediction)
        setStatus('confirmed')
        setHomeScore(String(data.mijnPrediction.home))
        setAwayScore(String(data.mijnPrediction.away))
      } else {
        setMijnPred(null)
        setStatus('idle')
        setHomeScore('')
        setAwayScore('')
      }

      setOnthuld(data.onthuld)
      setAnderePredicties(data.anderePredicties || [])
      setAantalVoorspeld(data.aantalVoorspeld || 0)
      setTotaalSpelers(data.totaalSpelers || 0)
    } catch (e) {}
  }

  useEffect(() => {
    setWijzigenModus(false)
    setErrorMsg('')
    laad()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixture.matchId, speler.id])

  async function handleBevestigen() {
    if (homeScore === '' || awayScore === '') { setErrorMsg('Vul beide scores in'); return }
    setErrorMsg('')
    setStatus('loading')
    try {
      const r = await fetch('/api/prediction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId: fixture.matchId, playerId: speler.id,
          home: Number(homeScore), away: Number(awayScore),
          datumISO: fixture.datumISO,
        })
      })
      const data = await r.json()
      if (!r.ok || !data.success) {
        setErrorMsg(data.error || 'Opslaan mislukt')
        setStatus(mijnPred ? 'confirmed' : 'idle')
        return
      }
      setMijnPred(data.prediction)
      setStatus('confirmed')
      setWijzigenModus(false)
      await laad()
    } catch (e) { setErrorMsg('Netwerkfout'); setStatus(mijnPred ? 'confirmed' : 'idle') }
  }

  function handleWijzigen() {
    setWijzigenModus(true)
    setStatus('idle')
  }

  function totoLabel(home, away) {
    if (home > away) return '1'
    if (home < away) return '2'
    return 'X'
  }

  if (isSluiting && !mijnPred) {
    return (
      <div className={styles.card}>
        <div className={styles.gesloten}>
          <span className={styles.geslotenIcon}>🔒</span>
          <p className={styles.geslotenTekst}>
            {isBezig ? 'Wedstrijd is begonnen' : 'Wedstrijd afgelopen'}
          </p>
          <p className={styles.geslotenSub}>Je hebt niet op tijd voorspeld — 0 punten voor deze wedstrijd.</p>
        </div>
      </div>
    )
  }

  const toonInvoer = status !== 'confirmed' || wijzigenModus

  return (
    <div className={styles.card}>
      <h2 className={styles.titel}>
        Jouw voorspelling
        <span className={styles.spelerBadge}>{speler.naam}</span>
      </h2>

      {toonInvoer && !isSluiting && (
        <div className={styles.invoer}>
          <div className={styles.scoreRij}>
            <div className={styles.scoreBlok}>
              <label className={styles.scoreLabel}>{fixture.thuis}</label>
              <input type="number" min="0" max="20"
                value={homeScore} onChange={e => setHomeScore(e.target.value)}
                className={styles.scoreInput} placeholder="0" inputMode="numeric" />
            </div>
            <div className={styles.scoreDash}>-</div>
            <div className={styles.scoreBlok}>
              <label className={styles.scoreLabel}>{fixture.uit}</label>
              <input type="number" min="0" max="20"
                value={awayScore} onChange={e => setAwayScore(e.target.value)}
                className={styles.scoreInput} placeholder="0" inputMode="numeric" />
            </div>
          </div>
          {errorMsg && <p className={styles.fout}>{errorMsg}</p>}
          <button className={styles.bevestigBtn} onClick={handleBevestigen} disabled={status === 'loading'}>
            {status === 'loading' ? <span className={styles.btnSpinner} /> : 'Voorspelling bevestigen'}
          </button>
          {wijzigenModus && (
            <button className={styles.annuleerBtn} onClick={() => { setWijzigenModus(false); setStatus('confirmed') }}>
              Annuleren
            </button>
          )}
        </div>
      )}

      {status === 'confirmed' && mijnPred && !wijzigenModus && (
        <div className={styles.bevestigd}>
          <div className={styles.bevestigdScore}>
            <span className={styles.bevestigdGetal}>{mijnPred.home}</span>
            <span className={styles.bevestigdDash}>-</span>
            <span className={styles.bevestigdGetal}>{mijnPred.away}</span>
          </div>
          <div className={styles.toto}>Toto: <strong>{totoLabel(mijnPred.home, mijnPred.away)}</strong></div>
          <div className={styles.bevestigdCheck}>✓ Bevestigd</div>
          {!onthuld && !isSluiting && (
            <>
              <p className={styles.wacht}>
                {aantalVoorspeld} van {totaalSpelers} spelers hebben voorspeld…
              </p>
              <button className={styles.wijzigenBtn} onClick={handleWijzigen}>Wijzigen</button>
            </>
          )}
          {onthuld && (
            <p className={styles.vergrendeld}>🔒 Voorspellingen zijn onthuld</p>
          )}
        </div>
      )}

      {onthuld && anderePredicties.length > 0 && (
        <div className={styles.andereWrap}>
          <div className={styles.scheidingslijn} />
          <h3 className={styles.andereLabel}>Voorspellingen andere spelers</h3>
          <div className={styles.andereLijst}>
            {anderePredicties.map(p => (
              <div key={p.playerId} className={styles.andereRij}>
                <span className={styles.andereNaam}>{p.naam}</span>
                <span className={styles.andereScoreKlein}>{p.home} – {p.away}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
