import { useState, useRef } from 'react'
import { maakTrend, asStappen } from '../../shared/trend.js'
import styles from './Trendlijn.module.css'

// Het puntenverloop over het seizoen: één lijn per deelnemer, van wedstrijd 1
// tot en met de laatste wedstrijd die op de agenda staat.
//
// De kleuren zijn getoetst op onderscheid bij kleurenblindheid en op contrast
// met de donkere achtergrond. Ze staan in vaste volgorde: een speler houdt zijn
// kleur, ook als er iemand bij komt. Verander ze niet zonder opnieuw te toetsen.
const KLEUREN = ['#E1000E', '#5B8DEF', '#B08320', '#2FA083', '#A371E8']

// Tekengebied. De SVG schaalt mee met de breedte van het scherm; deze maten
// zijn dus verhoudingen, geen pixels.
const B = 360
const H = 230
const MARGE = { boven: 14, rechts: 50, onder: 30, links: 32 }
const VLAK = {
  x: MARGE.links,
  y: MARGE.boven,
  b: B - MARGE.links - MARGE.rechts,
  h: H - MARGE.boven - MARGE.onder,
}

export default function Trendlijn({ resultaten, fixtures, naamPerSpeler, speler, onTerug }) {
  // Welke wedstrijd staat er onder de aanwijzer of vinger. Null = geen.
  const [gekozenNr, setGekozenNr] = useState(null)
  const svgRef = useRef(null)

  const trend = maakTrend(resultaten, fixtures, naamPerSpeler)
  const { top, stappen } = asStappen(trend.maxPunten)

  // Minstens tot wedstrijd 1, anders deelt de schaal door nul.
  const laatsteX = Math.max(1, trend.totaal)
  const xVan = nr => VLAK.x + (nr / laatsteX) * VLAK.b
  const yVan = punten => VLAK.y + VLAK.h - (punten / top) * VLAK.h

  function kiesOpPositie(clientX) {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    if (rect.width === 0) return
    // Van schermpixels terug naar de coördinaten van de SVG.
    const inSvg = ((clientX - rect.left) / rect.width) * B
    const nr = Math.round(((inSvg - VLAK.x) / VLAK.b) * laatsteX)
    const gespeeldeNrs = trend.gespeeld.map(g => g.nr)
    if (gespeeldeNrs.length === 0) return
    // De dichtstbijzijnde gespeelde wedstrijd, want alleen daar staat een punt.
    const dichtstbij = gespeeldeNrs.reduce((a, b) => (Math.abs(b - nr) < Math.abs(a - nr) ? b : a))
    setGekozenNr(dichtstbij)
  }

  if (trend.reeksen.length === 0) {
    return (
      <div className={styles.wrapper}>
        <button className={styles.terug} onClick={onTerug}>‹ Terug naar klassement</button>
        <p className={styles.leeg}>
          Nog geen verloop te tonen — zodra de eerste uitslag verwerkt is,
          verschijnt hier de lijn.
        </p>
      </div>
    )
  }

  const gekozen = gekozenNr === null ? null : trend.gespeeld.find(g => g.nr === gekozenNr)

  // Eindlabels die elkaar zouden overlappen uit elkaar duwen. Twee deelnemers
  // eindigen vaak maar een paar punten uit elkaar, en dan vallen de namen over
  // elkaar heen. De lijn zelf blijft staan waar hij staat; alleen het tekstje
  // schuift op.
  const LABEL_HOOGTE = 11
  const labelY = {}
  let vorige = -Infinity
  for (const r of [...trend.reeksen].sort((a, b) => b.eind - a.eind)) {
    const wens = yVan(r.eind) + 4
    const y = Math.max(wens, vorige + LABEL_HOOGTE)
    labelY[r.playerId] = y
    vorige = y
  }

  return (
    <div className={styles.wrapper}>
      <button className={styles.terug} onClick={onTerug}>‹ Terug naar klassement</button>

      <h2 className={styles.titel}>Trendlijn</h2>
      <p className={styles.onderschrift}>
        Puntenverloop na elke gespeelde wedstrijd. {trend.laatstGespeeld} van de{' '}
        {trend.totaal} wedstrijden gespeeld.
      </p>

      {/* Uitleesregel bij de aanwijzer. Een zwevende tekstballon werkt slecht op
          een telefoonscherm van 360 pixels breed; een vaste regel onder de titel
          leest rustiger en staat niet in de weg. */}
      <div className={styles.uitlezing} aria-live="polite">
        {gekozen ? (
          <>
            <span className={styles.uitlezingNr}>#{gekozen.nr}</span>
            {gekozen.thuis && (
              <span className={styles.uitlezingWedstrijd}>
                {gekozen.thuis} {gekozen.uitslag?.home}–{gekozen.uitslag?.away} {gekozen.uit}
              </span>
            )}
            {trend.reeksen.map((r, i) => {
              const punt = r.punten.find(p => p.nr === gekozen.nr)
              return (
                <span key={r.playerId} className={styles.uitlezingSpeler}>
                  <span className={styles.stip} style={{ background: KLEUREN[i % KLEUREN.length] }} />
                  {r.naam} {punt ? punt.totaal : '—'}
                </span>
              )
            })}
          </>
        ) : (
          <span className={styles.uitlezingHint}>Tik of beweeg over de grafiek voor een stand per wedstrijd</span>
        )}
      </div>

      <svg
        ref={svgRef}
        className={styles.grafiek}
        viewBox={`0 0 ${B} ${H}`}
        role="img"
        aria-label={`Puntenverloop van ${trend.reeksen.map(r => `${r.naam}: ${r.eind} punten`).join(', ')} na ${trend.laatstGespeeld} van ${trend.totaal} wedstrijden`}
        onPointerMove={e => kiesOpPositie(e.clientX)}
        onPointerDown={e => kiesOpPositie(e.clientX)}
        onPointerLeave={() => setGekozenNr(null)}
      >
        {/* Hulplijnen en y-as. Bewust ingetogen: de lijnen zijn het onderwerp. */}
        {stappen.map(w => (
          <g key={w}>
            <line
              x1={VLAK.x} x2={VLAK.x + VLAK.b}
              y1={yVan(w)} y2={yVan(w)}
              className={styles.raster}
            />
            <text x={VLAK.x - 6} y={yVan(w) + 3} className={styles.asLabel} textAnchor="end">{w}</text>
          </g>
        ))}

        {/* X-as: het eerste nummer, de laatst gespeelde wedstrijd en de laatste
            op de agenda. Die laatste twee zijn precies wat je wilt aflezen:
            hoever we zijn, en hoever het seizoen loopt. */}
        <line
          x1={VLAK.x} x2={VLAK.x + VLAK.b}
          y1={VLAK.y + VLAK.h} y2={VLAK.y + VLAK.h}
          className={styles.as}
        />
        {[...new Set([1, trend.laatstGespeeld, trend.totaal])]
          .filter(nr => nr > 0)
          .map(nr => (
            <text
              key={nr}
              x={xVan(nr)}
              y={VLAK.y + VLAK.h + 14}
              className={styles.asLabel}
              textAnchor={nr === trend.totaal ? 'end' : nr === 1 ? 'start' : 'middle'}
            >
              {nr}
            </text>
          ))}
        <text x={VLAK.x + VLAK.b / 2} y={H - 2} className={styles.asTitel} textAnchor="middle">
          wedstrijd
        </text>

        {/* De streep tot waar er gespeeld is: alles rechts daarvan moet nog
            komen. Zonder die markering lijkt een lijn die halverwege stopt op
            een fout. */}
        {trend.laatstGespeeld < trend.totaal && (
          <line
            x1={xVan(trend.laatstGespeeld)} x2={xVan(trend.laatstGespeeld)}
            y1={VLAK.y} y2={VLAK.y + VLAK.h}
            className={styles.grens}
          />
        )}

        {gekozen && (
          <line
            x1={xVan(gekozen.nr)} x2={xVan(gekozen.nr)}
            y1={VLAK.y} y2={VLAK.y + VLAK.h}
            className={styles.kruisdraad}
          />
        )}

        {trend.reeksen.map((r, i) => {
          const kleur = KLEUREN[i % KLEUREN.length]
          const pad = r.punten.map(p => `${xVan(p.nr)},${yVan(p.totaal)}`).join(' ')
          const laatste = r.punten[r.punten.length - 1]
          return (
            <g key={r.playerId}>
              <polyline points={pad} fill="none" stroke={kleur} strokeWidth="2"
                strokeLinejoin="round" strokeLinecap="round" />
              {r.punten.slice(1).map(p => (
                <circle
                  key={p.nr}
                  cx={xVan(p.nr)} cy={yVan(p.totaal)} r="4"
                  fill={kleur}
                  className={styles.punt}
                />
              ))}
              {/* Naam en stand aan het eind van de lijn, zodat je niet heen en
                  weer hoeft te kijken naar een legenda. */}
              <text
                x={xVan(laatste.nr) + 8}
                y={labelY[r.playerId]}
                className={styles.eindLabel}
              >
                {r.naam} {laatste.totaal}
              </text>
            </g>
          )
        })}
      </svg>

      <div className={styles.legenda}>
        {trend.reeksen.map((r, i) => (
          <span key={r.playerId} className={styles.legendaItem}>
            <span className={styles.stip} style={{ background: KLEUREN[i % KLEUREN.length] }} />
            <span className={r.naam === speler ? styles.jezelf : ''}>{r.naam}</span>
          </span>
        ))}
      </div>

      <details className={styles.tabelBlok}>
        <summary className={styles.tabelKop}>Tabelweergave</summary>
        <div className={styles.tabelScroll}>
          <table className={styles.tabel}>
            <thead>
              <tr>
                <th>#</th>
                {trend.reeksen.map(r => <th key={r.playerId}>{r.naam}</th>)}
              </tr>
            </thead>
            <tbody>
              {trend.gespeeld.map(g => (
                <tr key={g.nr}>
                  <th scope="row">{g.nr}</th>
                  {trend.reeksen.map(r => (
                    <td key={r.playerId}>{r.punten.find(p => p.nr === g.nr)?.totaal ?? '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
