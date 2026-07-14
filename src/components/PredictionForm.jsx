import { useState, useEffect, useRef } from 'react'
import { cssVar, tekenAfgerondeRect, berekenAdaptieveDpr, deelOfValTerug } from '../lib/deelHelpers.js'
import { competitieNaam } from '../../shared/competities.js'
import styles from './PredictionForm.module.css'

// Bouwt een PNG-afbeelding (canvas) van deze ene wedstrijd: teams, eventuele
// eindstand, en de voorspelling van iedere speler (met punten/totaal als de
// uitslag al verwerkt is). Zelfde stijl/aanpak als de klassement-afbeelding
// op het Totaal-scherm, zie ../lib/deelHelpers.js voor de gedeelde,
// iOS-bestendige bouwstenen.
async function bouwWedstrijdAfbeelding(fixture, alleVoorspellingen, matchResultaat) {
  if (document.fonts && document.fonts.ready) {
    try { await document.fonts.ready } catch (_) {}
  }

  const kleur = {
    bg: cssVar('--psv-bg', '#111111'),
    surface: cssVar('--psv-surface', '#1E1E1E'),
    border: cssVar('--psv-border', '#2E2E2E'),
    wit: cssVar('--psv-white', '#FFFFFF'),
    rood: cssVar('--psv-red', '#E1000E'),
    grijsLicht: '#CBD1D9',
    goud: cssVar('--gold', '#F5B800'),
    groen: cssVar('--green', '#22C55E'),
  }
  const fontDisplay = "'Barlow Condensed', Arial, sans-serif"
  const fontBody = "'Inter', -apple-system, sans-serif"

  const PAD = 28
  const heeftPunten = !!matchResultaat
  // Zonder puntenkolom (wedstrijd nog niet verwerkt) is er maar 2 kolommen
  // nodig — dan past een smallere canvas beter, en staat de voorspelling
  // dicht bij de naam i.p.v. helemaal tot de rechterrand uitgerekt te worden
  // (wat op een brede canvas een kaal, uit elkaar getrokken beeld gaf).
  const W = heeftPunten ? 760 : 480
  const kolX = heeftPunten
    ? [PAD, PAD + 200, PAD + 380, W - PAD - 16]
    : [PAD, PAD + 220]

  let hoogte = PAD
  hoogte += 46 // titel
  hoogte += 26 + 16 // onderschrift + marge
  hoogte += 22 // competitie/datum-regel
  hoogte += 34 // teams+score-regel
  hoogte += 24 // tabel-header
  hoogte += alleVoorspellingen.length * 26
  hoogte += PAD
  const H = Math.ceil(hoogte)

  const dpr = berekenAdaptieveDpr(W, H, 5)
  const canvas = document.createElement('canvas')
  canvas.width = W * dpr
  canvas.height = H * dpr
  const ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)

  ctx.fillStyle = kleur.bg
  ctx.fillRect(0, 0, W, H)

  let cy = PAD

  ctx.fillStyle = kleur.rood
  ctx.font = `900 34px ${fontDisplay}`
  ctx.textAlign = 'left'
  ctx.fillText('PSV POULE', PAD, cy + 32)
  cy += 46

  ctx.fillStyle = kleur.grijsLicht
  ctx.font = `700 16px ${fontBody}`
  ctx.fillText('Voorspellingen', PAD, cy + 14)
  cy += 26 + 16

  ctx.font = `800 13px ${fontBody}`
  const compTekst = competitieNaam(fixture.competitie)
  const compBreedte = ctx.measureText(compTekst).width
  tekenAfgerondeRect(ctx, PAD - 6, cy - 5, compBreedte + 12, 21, 4)
  ctx.fillStyle = kleur.rood
  ctx.fill()
  ctx.fillStyle = kleur.wit
  ctx.fillText(compTekst, PAD, cy + 10)
  ctx.fillStyle = kleur.grijsLicht
  ctx.font = `600 14px ${fontBody}`
  ctx.textAlign = 'right'
  ctx.fillText(`#${fixture.volgnummer || '—'} · ${fixture.datum}`, W - PAD, cy + 10)
  ctx.textAlign = 'left'
  cy += 22

  ctx.fillStyle = kleur.wit
  ctx.font = `900 26px ${fontDisplay}`
  const eindstandTekst = matchResultaat
    ? `${fixture.thuis}  ${matchResultaat.uitslag.home}–${matchResultaat.uitslag.away}  ${fixture.uit}`
    : `${fixture.thuis}  vs  ${fixture.uit}`
  ctx.fillText(eindstandTekst, PAD, cy + 22)
  cy += 34

  ctx.fillStyle = kleur.grijsLicht
  ctx.font = `800 12px ${fontBody}`
  ctx.fillText('SPELER', kolX[0], cy + 10)
  ctx.fillText('VOORSPELLING', kolX[1], cy + 10)
  if (heeftPunten) {
    ctx.fillText('PUNTEN', kolX[2], cy + 10)
    ctx.textAlign = 'right'
    ctx.fillText('TOTAAL', kolX[3], cy + 10)
  }
  ctx.textAlign = 'left'
  cy += 24

  for (const p of alleVoorspellingen) {
    ctx.fillStyle = kleur.wit
    ctx.font = `700 15px ${fontBody}`
    ctx.fillText(p.naam, kolX[0], cy + 14)

    ctx.fillStyle = p.pred ? kleur.wit : kleur.grijsLicht
    ctx.font = p.pred ? `700 15px ${fontBody}` : `italic 500 14px ${fontBody}`
    ctx.fillText(p.pred ? `${p.pred.home}–${p.pred.away}` : 'geen voorspelling', kolX[1], cy + 14)

    if (heeftPunten) {
      const punten = matchResultaat.punten?.[p.playerId] ?? 0
      const totaal = matchResultaat.totalen?.[p.playerId] ?? '—'
      ctx.fillStyle = punten >= 10 ? kleur.goud : punten >= 7 ? kleur.groen : punten >= 5 ? '#3B82F6' : kleur.grijsLicht
      ctx.font = `800 15px ${fontBody}`
      ctx.fillText(`+${punten}`, kolX[2], cy + 14)

      ctx.fillStyle = kleur.wit
      ctx.font = `700 15px ${fontBody}`
      ctx.textAlign = 'right'
      ctx.fillText(String(totaal), kolX[3], cy + 14)
      ctx.textAlign = 'left'
    }

    cy += 26
  }

  return new Promise(resolve => {
    canvas.toBlob(blob => resolve(blob), 'image/png', 0.95)
  })
}

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
  const [matchResultaat, setMatchResultaat] = useState(null)
  const [delenBezig, setDelenBezig] = useState(false)
  const delenBezigRef = useRef(false)
  const deelBlobRef = useRef(null)

  const isAfgelopen = ['FT','AET','PEN'].includes(fixture.status)
  const isBezig = ['1H','HT','2H','ET','BT','LIVE'].includes(fixture.status)
  const isSluitingLokaal = isAfgelopen || isBezig
  const isSluiting = onthuld || isSluitingLokaal

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
    setMatchResultaat(null)
    deelBlobRef.current = null
    laad()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixture.matchId, speler.id])

  useEffect(() => {
    if (!onthuld) return
    let geannuleerd = false
    fetch(`/api/results?matchId=${fixture.matchId}`)
      .then(r => r.json())
      .then(data => { if (!geannuleerd) setMatchResultaat(data.result || null) })
      .catch(() => {})
    return () => { geannuleerd = true }
  }, [onthuld, fixture.matchId])

  useEffect(() => {
    if (!onthuld) return
    const alleVoorspellingen = [
      { playerId: speler.id, naam: speler.naam, pred: mijnPred },
      ...anderePredicties.map(p => ({ playerId: p.playerId, naam: p.naam, pred: { home: p.home, away: p.away } })),
    ]
    let geannuleerd = false
    bouwWedstrijdAfbeelding(fixture, alleVoorspellingen, matchResultaat).then(blob => {
      if (!geannuleerd) deelBlobRef.current = blob
    }).catch(() => {})
    return () => { geannuleerd = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onthuld, mijnPred, anderePredicties, matchResultaat, fixture.matchId])

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

  async function handleDelen() {
    if (delenBezigRef.current) return
    delenBezigRef.current = true
    setDelenBezig(true)
    try {
      const alleVoorspellingen = [
        { playerId: speler.id, naam: speler.naam, pred: mijnPred },
        ...anderePredicties.map(p => ({ playerId: p.playerId, naam: p.naam, pred: { home: p.home, away: p.away } })),
      ]
      const blob = deelBlobRef.current || await bouwWedstrijdAfbeelding(fixture, alleVoorspellingen, matchResultaat)
      const tekstRegels = [
        `⚽ *${fixture.thuis} - ${fixture.uit}*`,
        matchResultaat ? `Eindstand: *${matchResultaat.uitslag.home}-${matchResultaat.uitslag.away}*` : '',
        '',
        ...alleVoorspellingen.map(p => `${p.naam}: ${p.pred ? `${p.pred.home}-${p.pred.away}` : 'geen voorspelling'}`),
      ].filter(Boolean)
      await deelOfValTerug({
        blob,
        bestandsnaam: `psv-poule-${fixture.thuis}-${fixture.uit}.png`,
        titel: 'PSV Poule',
        tekst: `${fixture.thuis} - ${fixture.uit}`,
        tekstFallbackUrl: `https://wa.me/?text=${encodeURIComponent(tekstRegels.join('\n'))}`,
      })
    } finally {
      delenBezigRef.current = false
      setDelenBezig(false)
    }
  }

  const toonInvoer = status !== 'confirmed' || wijzigenModus

  return (
    <div className={styles.card}>
      <h2 className={styles.titel}>
        Jouw voorspelling
        <span className={styles.spelerBadge}>{speler.naam}</span>
      </h2>

      {isSluiting && !mijnPred && (
        <div className={styles.gesloten}>
          <span className={styles.geslotenIcon}>🔒</span>
          <p className={styles.geslotenTekst}>
            Voorspellen is gesloten
          </p>
          <p className={styles.geslotenSub}>Je hebt niet op tijd voorspeld — 0 punten voor deze wedstrijd.</p>
        </div>
      )}

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

      {onthuld && (
        <button className={styles.deelBtn} onClick={handleDelen} disabled={delenBezig}>
          {delenBezig ? 'Bezig…' : (
            <>
              <svg className={styles.deelIcoon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M12 3v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M7 8l5-5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Delen
            </>
          )}
        </button>
      )}
    </div>
  )
}
