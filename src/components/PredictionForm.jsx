import { useState, useEffect } from 'react'
import styles from './PredictionForm.module.css'

export default function PredictionForm({ fixture, speler }) {
  const [homeScore, setHomeScore] = useState('')
  const [awayScore, setAwayScore] = useState('')
  const [status, setStatus] = useState('idle')
  const [mijnPred, setMijnPred] = useState(null)
  const [anderePred, setAnderePred] = useState(null)
  const [beideBevest, setBeideBevest] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const andere = speler === 'niek' ? 'huub' : 'niek'
  const isAfgelopen = ['FT','AET','PEN'].includes(fixture.status)
  const isBezig = ['1H','HT','2H','ET','BT','LIVE'].includes(fixture.status)
  const isSluiting = isAfgelopen || isBezig

  useEffect(() => {
    async function laad() {
      try {
        const r = await fetch(`/api/prediction?matchId=${fixture.matchId}`)
        const data = await r.json()
        const mijn = data[speler]
        const andere_ = data[andere]
        if (mijn?.confirmed) {
          setMijnPred(mijn)
          setStatus('confirmed')
          setHomeScore(String(mijn.home))
          setAwayScore(String(mijn.away))
        }
        if (data.beideBevest) {
          setBeideBevest(true)
          setAnderePred(andere_)
        }
      } catch (e) {}
    }
    laad()
  }, [fixture.matchId, speler])

  async function handleBevestigen() {
    if (homeScore === '' || awayScore === '') { setErrorMsg('Vul beide scores in'); return }
    setErrorMsg('')
    setStatus('loading')
    try {
      const r = await fetch('/api/prediction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId: fixture.matchId, speler,
          home: Number(homeScore), away: Number(awayScore),
          datumISO: fixture.datumISO,
        })
      })
      const data = await r.json()
      if (!r.ok || !data.success) { setErrorMsg(data.error || 'Opslaan mislukt'); setStatus('idle'); return }
      setMijnPred(data.prediction)
      setStatus('confirmed')
      const check = await fetch(`/api/prediction?matchId=${fixture.matchId}`)
      const checkData = await check.json()
      if (checkData.beideBevest) { setBeideBevest(true); setAnderePred(checkData[andere]) }
    } catch (e) { setErrorMsg('Netwerkfout, probeer opnieuw'); setStatus('idle') }
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
        </div>
      </div>
    )
  }

  return (
    <div className={styles.card}>
      <h2 className={styles.titel}>
        Jouw voorspelling
        <span className={styles.spelerBadge}>{speler === 'niek' ? 'Niek' : 'Huub'}</span>
      </h2>
      {status !== 'confirmed' && !isSluiting && (
        <div className={styles.invoer}>
          <div className={styles.scoreRij}>
            <div className={styles.scoreBlok}>
              <label className={styles.scoreLabel}>{fixture.thuis}</label>
              <input
                type="number" min="0" max="20"
                value={homeScore} onChange={e => setHomeScore(e.target.value)}
                className={styles.scoreInput} placeholder="0" inputMode="numeric"
              />
            </div>
            <div className={styles.scoreDash}>-</div>
            <div className={styles.scoreBlok}>
              <label className={styles.scoreLabel}>{fixture.uit}</label>
              <input
                type="number" min="0" max="20"
                value={awayScore} onChange={e => setAwayScore(e.target.value)}
                className={styles.scoreInput} placeholder="0" inputMode="numeric"
              />
            </div>
          </div>
          {errorMsg && <p className={styles.fout}>{errorMsg}</p>}
          <button className={styles.bevestigBtn} onClick={handleBevestigen} disabled={status === 'loading'}>
            {status === 'loading' ? <span className={styles.btnSpinner} /> : 'Voorspelling bevestigen'}
          </button>
        </div>
      )}
      {status === 'confirmed' && mijnPred && (
        <div className={styles.bevestigd}>
          <div className={styles.bevestigdScore}>
            <span className={styles.bevestigdGetal}>{mijnPred.home}</span>
            <span className={styles.bevestigdDash}>-</span>
            <span className={styles.bevestigdGetal}>{mijnPred.away}</span>
          </div>
          <div className={styles.toto}>Toto: <strong>{totoLabel(mijnPred.home, mijnPred.away)}</strong></div>
          <div className={styles.bevestigdCheck}>Bevestigd</div>
          {!beideBevest && !isSluiting && (
            <p className={styles.wacht}>Wachten op {andere === 'niek' ? 'Niek' : 'Huub'}...</p>
          )}
        </div>
      )}
      {beideBevest && anderePred && (
        <div className={styles.andereWrap}>
          <div className={styles.scheidingslijn} />
          <h3 className={styles.andereLabel}>Voorspelling {andere === 'niek' ? 'Niek' : 'Huub'}</h3>
          <div className={styles.andereScore}>
            <span className={styles.andereGetal}>{anderePred.home}</span>
            <span className={styles.andereDash}>-</span>
            <span className={styles.andereGetal}>{anderePred.away}</span>
          </div>
          <div className={styles.toto}>Toto: <strong>{totoLabel(anderePred.home, anderePred.away)}</strong></div>
        </div>
      )}
    </div>
  )
}
