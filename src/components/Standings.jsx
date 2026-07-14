import { useState, useEffect, useRef } from 'react'
import { zoekLogo } from '../../shared/teams.js'
import { competitieNaam } from '../../shared/competities.js'
import { cssVar, tekenAfgerondeRect, berekenAdaptieveDpr, VEILIGE_MAX_AFMETING, deelOfValTerug, fillTextRechtsUitgelijnd } from '../lib/deelHelpers.js'
import styles from './Standings.module.css'

// Vult een string met spaties tot vaste lengte (rechts uitlijnen tekst).
function padRechts(str, len) {
  str = String(str)
  return str.length >= len ? str : str + ' '.repeat(len - str.length)
}
// Vult een string met spaties tot vaste lengte (links uitlijnen, voor getallen).
function padLinks(str, len) {
  str = String(str)
  return str.length >= len ? str : ' '.repeat(len - str.length) + str
}

// Bouwt per wedstrijd een uitgelijnde tabel binnen een WhatsApp-monospace-blok
// (```...```), zodat naam/voorspelling/punten/totaal altijd nette kolommen
// vormen i.p.v. op smalle telefoonschermen af te breken over meerdere regels.
function bouwSpelerTabel(r, spelerNaamMap) {
  const rijen = Object.entries(r.predicties || {}).map(([playerId, pred]) => {
    const naam = spelerNaamMap[playerId] || '???'
    const punten = r.punten?.[playerId] ?? 0
    const totaal = r.totalen?.[playerId] ?? '—'
    const vrsp = pred ? `${pred.home}-${pred.away}` : '-'
    return { naam, vrsp, punt: `+${punten}`, totaal: String(totaal) }
  })
  if (rijen.length === 0) return null

  const naamW = Math.max(6, ...rijen.map(x => x.naam.length))
  const vrspW = Math.max(4, ...rijen.map(x => x.vrsp.length))
  const puntW = Math.max(2, ...rijen.map(x => x.punt.length))
  const totW  = Math.max(3, ...rijen.map(x => x.totaal.length))

  const regels = []
  regels.push(`${padRechts('Speler', naamW)} ${padRechts('Vrsp', vrspW)} ${padLinks('Pt', puntW)} ${padLinks('Tot', totW)}`)
  for (const x of rijen) {
    regels.push(`${padRechts(x.naam, naamW)} ${padRechts(x.vrsp, vrspW)} ${padLinks(x.punt, puntW)} ${padLinks(x.totaal, totW)}`)
  }
  return regels.join('\n')
}

function bouwWhatsAppTekst(klassement, results, spelerNaamMap) {
  const regels = []
  regels.push('🏆 *PSV Poule — Klassement*')
  regels.push('')
  klassement.forEach((s, i) => {
    regels.push(`${i + 1}. ${s.naam}: *${s.punten}* punten`)
  })
  regels.push('')
  regels.push('_Alle wedstrijden:_')

  const gesorteerd = [...results].sort((a, b) => new Date(b.datumISO) - new Date(a.datumISO))
  for (const r of gesorteerd) {
    regels.push('')
    regels.push(`#${r.volgnummer || '—'} ${r.datum} — ${competitieNaam(r.competitie)}`)
    regels.push(`${r.thuis} ${r.uitslag.home}-${r.uitslag.away} ${r.uit}`)
    const tabel = bouwSpelerTabel(r, spelerNaamMap)
    if (tabel) {
      regels.push('```')
      regels.push(tabel)
      regels.push('```')
    }
  }

  return regels.join('\n')
}

// Handmatige afgeronde rechthoek en cssVar komen nu uit ../lib/deelHelpers.js

// Bouwt een PNG-afbeelding (canvas) van klassement + alle wedstrijden, in de
// stijl van de app zelf. Geeft een Blob terug die via de Web Share API
// gedeeld kan worden (navigator.share met files) — dat voorkomt het
// "past niet op 1 regel"-probleem van platte tekst volledig, want een
// afbeelding heeft geen regel-afbreekprobleem.
async function bouwDeelAfbeelding(klassement, resultaten, spelerNaamMap) {
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
  const W = 760
  const klassementRijHoogte = 52
  const kolX = [PAD + 16, PAD + 200, PAD + 380, W - PAD - 16]

  function matchHoogte(r) {
    const aantalSpelers = Object.keys(r.predicties || {}).length
    return 16 + 22 + 34 + 24 + aantalSpelers * 26 + 16 + 16
  }

  let basisHoogte = PAD
  basisHoogte += 46
  basisHoogte += 26 + 16
  basisHoogte += 30
  basisHoogte += klassement.length * klassementRijHoogte
  basisHoogte += 20
  if (resultaten.length > 0) basisHoogte += 30

  const RUIMTE_VOOR_NOTITIE = 30
  let resultatenGetoond = resultaten
  let hoogte = basisHoogte
  for (let i = 0; i < resultaten.length; i++) {
    const volgende = hoogte + matchHoogte(resultaten[i])
    const restRuimte = i < resultaten.length - 1 ? RUIMTE_VOOR_NOTITIE : 0
    if (volgende + restRuimte + PAD > VEILIGE_MAX_AFMETING) {
      resultatenGetoond = resultaten.slice(0, i)
      break
    }
    hoogte = volgende
  }
  const aantalWeggelaten = resultaten.length - resultatenGetoond.length
  if (aantalWeggelaten > 0) hoogte += RUIMTE_VOOR_NOTITIE
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
  const datumTekst = new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
  ctx.fillText(`Klassement · ${datumTekst}`, PAD, cy + 14)
  cy += 26 + 16

  ctx.fillStyle = kleur.grijsLicht
  ctx.font = `800 14px ${fontBody}`
  ctx.fillText('KLASSEMENT', PAD, cy + 12)
  cy += 30

  klassement.forEach((s, i) => {
    const isLeider = i === 0
    const rijH = klassementRijHoogte - 8
    tekenAfgerondeRect(ctx, PAD, cy, W - PAD * 2, rijH, 10)
    ctx.fillStyle = isLeider ? 'rgba(245,184,0,0.10)' : kleur.surface
    ctx.fill()
    ctx.strokeStyle = isLeider ? 'rgba(245,184,0,0.35)' : kleur.border
    ctx.lineWidth = 1
    ctx.stroke()

    const midY = cy + rijH / 2 + 6

    ctx.fillStyle = kleur.grijsLicht
    ctx.font = `800 17px ${fontDisplay}`
    ctx.fillText(String(i + 1), PAD + 16, midY)

    ctx.fillStyle = isLeider ? kleur.goud : kleur.wit
    ctx.font = `700 18px ${fontBody}`
    ctx.fillText(s.naam + (isLeider ? '  👑' : ''), PAD + 48, midY)

    ctx.fillStyle = isLeider ? kleur.goud : kleur.wit
    ctx.font = `900 22px ${fontDisplay}`
    fillTextRechtsUitgelijnd(ctx, String(s.punten), W - PAD - 16, midY + 1)

    cy += klassementRijHoogte
  })

  cy += 20

  if (resultaten.length > 0) {
    ctx.fillStyle = kleur.grijsLicht
    ctx.font = `800 14px ${fontBody}`
    ctx.fillText('ALLE WEDSTRIJDEN', PAD, cy + 12)
    cy += 30

    for (const r of resultatenGetoond) {
      const spelers = Object.entries(r.predicties || {})
      const kaartHoogte = 16 + 22 + 34 + 24 + spelers.length * 26 + 16

      tekenAfgerondeRect(ctx, PAD, cy, W - PAD * 2, kaartHoogte, 12)
      ctx.fillStyle = kleur.surface
      ctx.fill()
      ctx.strokeStyle = kleur.border
      ctx.stroke()

      let ry = cy + 16

      ctx.font = `800 13px ${fontBody}`
      const compTekst = competitieNaam(r.competitie)
      const compBreedte = ctx.measureText(compTekst).width
      tekenAfgerondeRect(ctx, kolX[0] - 6, ry - 5, compBreedte + 12, 21, 4)
      ctx.fillStyle = kleur.rood
      ctx.fill()
      ctx.fillStyle = kleur.wit
      ctx.textAlign = 'left'
      ctx.fillText(compTekst, kolX[0], ry + 10)
      ctx.fillStyle = kleur.grijsLicht
      ctx.font = `600 14px ${fontBody}`
      fillTextRechtsUitgelijnd(ctx, `#${r.volgnummer || '—'} · ${r.datum}`, W - PAD - 16, ry + 10)
      ry += 22

      ctx.fillStyle = kleur.wit
      ctx.font = `900 22px ${fontDisplay}`
      ctx.fillText(`${r.thuis}  ${r.uitslag.home}–${r.uitslag.away}  ${r.uit}`, kolX[0], ry + 18)
      ry += 34

      ctx.fillStyle = kleur.grijsLicht
      ctx.font = `800 12px ${fontBody}`
      ctx.fillText('SPELER', kolX[0], ry + 10)
      ctx.fillText('VOORSPELLING', kolX[1], ry + 10)
      ctx.fillText('PUNTEN', kolX[2], ry + 10)
      fillTextRechtsUitgelijnd(ctx, 'TOTAAL', kolX[3], ry + 10)
      ry += 24

      for (const [playerId, pred] of spelers) {
        const naam = spelerNaamMap[playerId] || '???'
        const punten = r.punten?.[playerId] ?? 0
        const totaal = r.totalen?.[playerId] ?? '—'

        ctx.fillStyle = kleur.wit
        ctx.font = `700 15px ${fontBody}`
        ctx.fillText(naam, kolX[0], ry + 14)

        ctx.fillStyle = pred ? kleur.wit : kleur.grijsLicht
        ctx.font = pred ? `700 15px ${fontBody}` : `italic 500 14px ${fontBody}`
        ctx.fillText(pred ? `${pred.home}–${pred.away}` : 'geen voorspelling', kolX[1], ry + 14)

        ctx.fillStyle = punten >= 10 ? kleur.goud : punten >= 7 ? kleur.groen : punten >= 5 ? '#3B82F6' : kleur.grijsLicht
        ctx.font = `800 15px ${fontBody}`
        ctx.fillText(`+${punten}`, kolX[2], ry + 14)

        ctx.fillStyle = kleur.wit
        ctx.font = `700 15px ${fontBody}`
        fillTextRechtsUitgelijnd(ctx, String(totaal), kolX[3], ry + 14)

        ry += 26
      }

      cy += kaartHoogte + 16
    }

    if (aantalWeggelaten > 0) {
      ctx.fillStyle = kleur.grijsLicht
      ctx.font = `italic 600 13px ${fontBody}`
      ctx.textAlign = 'center'
      ctx.fillText(`+ ${aantalWeggelaten} eerdere wedstrijd${aantalWeggelaten === 1 ? '' : 'en'} — zie de app voor het volledige overzicht`, W / 2, cy + 10)
      ctx.textAlign = 'left'
    }
  }

  return new Promise(resolve => {
    canvas.toBlob(blob => resolve(blob), 'image/png', 0.95)
  })
}

export default function Standings({ fixtures, speler }) {
  const [totals, setTotals] = useState({})
  const [results, setResults] = useState([])
  const [spelerNaamMap, setSpelerNaamMap] = useState({})
  const [loading, setLoading] = useState(true)
  const deelBlobRef = useRef(null)

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

  useEffect(() => {
    if (Object.keys(totals).length === 0) return
    const klassementNu = Object.entries(totals)
      .map(([playerId, punten]) => ({ playerId, naam: spelerNaamMap[playerId] || '???', punten }))
      .sort((a, b) => b.punten - a.punten)
    const resultatenNu = [...results].sort((a, b) => new Date(b.datumISO) - new Date(a.datumISO))

    let geannuleerd = false
    bouwDeelAfbeelding(klassementNu, resultatenNu, spelerNaamMap).then(blob => {
      if (!geannuleerd) deelBlobRef.current = blob
    }).catch(() => {})

    return () => { geannuleerd = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totals, results, spelerNaamMap])

  function puntKleur(punt) {
    if (punt >= 10) return styles.puntGoud
    if (punt >= 7)  return styles.puntGroen
    if (punt >= 5)  return styles.puntBlauw
    return styles.puntNul
  }

  const klassement = Object.entries(totals)
    .map(([playerId, punten]) => ({ playerId, naam: spelerNaamMap[playerId] || '???', punten }))
    .sort((a, b) => b.punten - a.punten)

  const [delenBezig, setDelenBezig] = useState(false)
  const delenBezigRef = useRef(false)

  async function handleDelen() {
    if (delenBezigRef.current) return
    delenBezigRef.current = true
    setDelenBezig(true)
    try {
      const blob = deelBlobRef.current || await bouwDeelAfbeelding(klassement, gesorteerdeResultaten, spelerNaamMap)
      await deelOfValTerug({
        blob,
        bestandsnaam: 'psv-poule-klassement.png',
        titel: 'PSV Poule',
        tekst: 'Bekijk het klassement van de PSV Poule!',
        tekstFallbackUrl: `https://wa.me/?text=${encodeURIComponent(bouwWhatsAppTekst(klassement, results, spelerNaamMap))}`,
      })
    } finally {
      delenBezigRef.current = false
      setDelenBezig(false)
    }
  }

  if (loading) return (
    <div className={styles.loadState}>
      <div className="spinner" />
      <p>Resultaten laden…</p>
    </div>
  )

  const gesorteerdeResultaten = [...results].sort((a, b) => new Date(b.datumISO) - new Date(a.datumISO))

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
                <span className={styles.ranglijstNaamGroep}>
                  <span className={styles.ranglijstNaam}>{s.naam}</span>
                  {i === 0 && <span className={styles.kroon}>👑</span>}
                </span>
                <span className={styles.ranglijstPunt}>{s.punten}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {results.length > 0 && (
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
                  {r.thuisLogo && (
                    <img
                      src={r.thuisLogo}
                      alt=""
                      className={styles.teamLogo}
                      onError={e => {
                        const fallback = zoekLogo(r.thuis)
                        if (fallback && e.target.src !== fallback) {
                          e.target.src = fallback
                        } else {
                          e.target.style.visibility = 'hidden'
                        }
                      }}
                    />
                  )}
                  <span className={styles.teamCode}>{r.thuis}</span>
                  <span className={styles.uitslag}>{r.uitslag.home}–{r.uitslag.away}</span>
                  <span className={styles.teamCode}>{r.uit}</span>
                  {r.uitLogo && (
                    <img
                      src={r.uitLogo}
                      alt=""
                      className={styles.teamLogo}
                      onError={e => {
                        const fallback = zoekLogo(r.uit)
                        if (fallback && e.target.src !== fallback) {
                          e.target.src = fallback
                        } else {
                          e.target.style.visibility = 'hidden'
                        }
                      }}
                    />
                  )}
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
