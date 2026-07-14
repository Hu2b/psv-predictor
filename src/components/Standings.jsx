import { useState, useEffect, useRef } from 'react'
import { zoekLogo } from '../../shared/teams.js'
import { competitieNaam } from '../../shared/competities.js'
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

// Leest een CSS custom property (--psv-red e.d.) op zodat de afbeelding
// automatisch hetzelfde kleurenschema volgt als de rest van de app, zonder
// kleuren dubbel te hoeven onderhouden.
function cssVar(naam, fallback) {
  const waarde = getComputedStyle(document.documentElement).getPropertyValue(naam).trim()
  return waarde || fallback
}

// Handmatige afgeronde rechthoek i.p.v. ctx.roundRect(), voor bredere
// browserondersteuning (ook oudere WebViews die apps soms gebruiken om
// share-doelwitten te openen).
function tekenAfgerondeRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.arcTo(x + w, y, x + w, y + radius, radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius)
  ctx.lineTo(x + radius, y + h)
  ctx.arcTo(x, y + h, x, y + h - radius, radius)
  ctx.lineTo(x, y + radius)
  ctx.arcTo(x, y, x + radius, y, radius)
  ctx.closePath()
}

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
    // Bewust lichter dan de --psv-gray-lt van de live app: op een scherm in
    // de app is dat contrast prima, maar in een gedeelde/gecomprimeerde
    // afbeelding (WhatsApp e.d. comprimeren vaak nog eens) wordt dat te
    // schraal om goed te lezen. Leesbaarheid weegt hier zwaarder dan exact
    // dezelfde tint als de rest van de app.
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

  // --- Hoogte vooraf berekenen zodat het canvas meteen de juiste grootte heeft ---
  let hoogte = PAD
  hoogte += 46 // titel
  hoogte += 26 + 16 // onderschrift + marge
  hoogte += 30 // "KLASSEMENT"-label
  hoogte += klassement.length * klassementRijHoogte
  hoogte += 20

  if (resultaten.length > 0) {
    hoogte += 30 // "ALLE WEDSTRIJDEN"-label
    for (const r of resultaten) {
      const aantalSpelers = Object.keys(r.predicties || {}).length
      hoogte += 16 + 22 + 34 + 24 + aantalSpelers * 26 + 16 + 16
    }
  }
  hoogte += PAD
  const H = Math.ceil(hoogte)

  // 6x resolutie: bij veel wedstrijden wordt de afbeelding lang, en
  // messenger-apps zoals WhatsApp schalen 'm vaak nog eens terug voor de
  // preview/thumbnail. Let op: dit lost het "blurry worden bij inzoomen"
  // niet volledig op — dat is inherent aan elke pixel-gebaseerde afbeelding
  // (PNG incluis) zodra je verder inzoomt dan de daadwerkelijke resolutie.
  // Een hogere resolutie hier verschuift alleen het punt waarop dat gebeurt.
  const dpr = 6
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
    ctx.textAlign = 'right'
    ctx.fillText(String(s.punten), W - PAD - 16, midY + 1)
    ctx.textAlign = 'left'

    cy += klassementRijHoogte
  })

  cy += 20

  if (resultaten.length > 0) {
    ctx.fillStyle = kleur.grijsLicht
    ctx.font = `800 14px ${fontBody}`
    ctx.fillText('ALLE WEDSTRIJDEN', PAD, cy + 12)
    cy += 30

    for (const r of resultaten) {
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
      ctx.textAlign = 'right'
      ctx.fillText(`#${r.volgnummer || '—'} · ${r.datum}`, W - PAD - 16, ry + 10)
      ctx.textAlign = 'left'
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
      ctx.textAlign = 'right'
      ctx.fillText('TOTAAL', kolX[3], ry + 10)
      ctx.textAlign = 'left'
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
        ctx.textAlign = 'right'
        ctx.fillText(String(totaal), kolX[3], ry + 14)
        ctx.textAlign = 'left'

        ry += 26
      }

      cy += kaartHoogte + 16
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
  // De deel-afbeelding wordt vooraf (op de achtergrond) opgebouwd zodra de
  // data binnen is, i.p.v. pas op het moment van de tik op "Delen". Reden:
  // iOS Safari staat navigator.share() alleen toe als het vrijwel direct
  // (synchroon) binnen de tik-actie van de gebruiker wordt aangeroepen. Met
  // een `await` ervoor (zoals het opbouwen van de canvas-afbeelding) raakt
  // die koppeling met de tik kwijt, en blokkeert Safari zowel de deel-actie
  // als de terugval (window.open) stilzwijgend — geen foutmelding, gewoon
  // geen enkele reactie. Vandaar dit verschil tussen Mac (werkt wel) en
  // iPhone (geen respons). Met de afbeelding al klaarliggend hoeft
  // handleDelen zelf niets meer te awaiten vóór navigator.share().
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

  // Zodra totals/results/spelerNaamMap bekend zijn, alvast de deel-
  // afbeelding klaarzetten op de achtergrond (zie toelichting hierboven).
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
  // React-state (delenBezig) wordt asynchroon/gebatcht bijgewerkt — bij een
  // hele snelle dubbele tik kan de knop dan nog even niet-disabled zijn op
  // het moment dat de tweede tik binnenkomt, waardoor de afbeelding twee
  // keer wordt opgebouwd en gedeeld. Een ref is direct/synchroon en dekt dat
  // gat helemaal af, ongeacht render-timing.
  const delenBezigRef = useRef(false)

  function valTerugOpTekst() {
    const tekst = bouwWhatsAppTekst(klassement, results, spelerNaamMap)
    const url = `https://wa.me/?text=${encodeURIComponent(tekst)}`
    // window.open() met een nieuw tabblad wordt door mobiele Safari vaak
    // stilzwijgend geblokkeerd (veel strenger dan desktop Safari) — een
    // gewone paginanavigatie via location.href wordt niet als pop-up gezien
    // en werkt daardoor betrouwbaarder, ook op iPhone.
    window.location.href = url
  }

  async function handleDelen() {
    if (delenBezigRef.current) return
    delenBezigRef.current = true
    setDelenBezig(true)
    try {
      const kanBestandenDelen = typeof navigator.canShare === 'function' && typeof navigator.share === 'function'
      if (!kanBestandenDelen) {
        valTerugOpTekst()
        return
      }
      // Bij voorkeur de al-vooraf-opgebouwde afbeelding gebruiken (geen
      // wachttijd, cruciaal voor iOS Safari — zie toelichting hierboven).
      // Alleen als die om wat voor reden dan ook nog niet klaar is (bijv.
      // supersnel geklikt vóór de achtergrondtaak klaar was), alsnog on-the-
      // fly opbouwen als redelijke terugval.
      const blob = deelBlobRef.current || await bouwDeelAfbeelding(klassement, gesorteerdeResultaten, spelerNaamMap)
      if (!blob) {
        valTerugOpTekst()
        return
      }
      const bestand = new File([blob], 'psv-poule-klassement.png', { type: 'image/png' })
      if (!navigator.canShare({ files: [bestand] })) {
        valTerugOpTekst()
        return
      }
      await navigator.share({
        files: [bestand],
        title: 'PSV Poule',
        text: 'Bekijk het klassement van de PSV Poule!'
      })
    } catch (e) {
      // AbortError = gebruiker heeft de deel-dialoog zelf geannuleerd, geen actie nodig.
      if (e && e.name !== 'AbortError') {
        valTerugOpTekst()
      }
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
