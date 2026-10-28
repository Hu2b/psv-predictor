import { useState, useEffect } from 'react'
import { seizoenVan } from '../../shared/vloek.js'
import styles from './Vloek.module.css'

// De PSV-vloek: wie PSV verslaat, stort daarna zelf in. Of niet — dat is
// precies wat dit scherm uitzoekt.
//
// Het getal "7 van de 11" zegt op zichzelf niets, want misschien verliest elke
// club wel vaak. Daarom staat er altijd naast hoe vaak een club zijn wedstrijd
// gemiddeld verliest. Pas als de vloek daar duidelijk boven zit, is er iets
// aan de hand — en zit hij eronder, dan is dát de uitkomst.
// Hoeveel punten per wedstrijd de winnaar onder zijn eigen gemiddelde moet
// blijven voordat we het een vloek durven noemen. Een vijfde punt per duel is
// over een stuk of tien wedstrijden geen toeval meer.
const DREMPEL = 0.2

function seizoenLabel(datumISO) {
  const jaar = seizoenVan(datumISO)
  return jaar === null ? '' : kort(jaar)
}

// 2026 -> "26/27"
function kort(jaar) {
  return `${String(jaar).slice(2)}/${String(jaar + 1).slice(2)}`
}

// Eén cijfer achter de komma, met een komma zoals het hoort.
function getal(waarde) {
  if (waarde === null || waarde === undefined) return '—'
  return waarde.toFixed(1).replace('.', ',')
}

const COMPETITIE = { ERE: 'Eredivisie', KNVB: 'KNVB-beker' }

// Wat er op de chip komt te staan. Clubs die we kennen hebben een nette
// afkorting (HEE, UTR); een onbekende club — in de beker spelen amateurs mee —
// heeft alleen een interne sleutel met een tilde ervoor, en die hoort niet in
// beeld. Dan tonen we zijn naam.
function tegenLabel(wedstrijd) {
  const sleutel = wedstrijd.tegenstander || ''
  if (!sleutel.startsWith('~')) return sleutel
  return wedstrijd.tegenstanderNaam || sleutel.slice(1)
}

// Eén vervolgwedstrijd. De letter en de uitslag staan er altijd bij, dus de
// kleur is nooit het enige wat het verschil maakt.
function Chip({ wedstrijd }) {
  if (!wedstrijd.gespeeld) {
    return (
      <span className={`${styles.chip} ${styles.chipLeeg}`}>
        <span className={styles.chipKop}>— moet nog</span>
        <span className={styles.chipTegen}>{tegenLabel(wedstrijd)}</span>
      </span>
    )
  }

  const soort = wedstrijd.resultaat === 'V' ? styles.chipVerlies
    : wedstrijd.resultaat === 'W' ? styles.chipWinst
    : styles.chipGelijk

  return (
    <span
      className={`${styles.chip} ${soort}`}
      title={`${wedstrijd.datum} · ${COMPETITIE[wedstrijd.competitie] || wedstrijd.competitie}${wedstrijd.tegenstanderNaam ? ` · ${wedstrijd.tegenstanderNaam}` : ''}`}
    >
      <span className={styles.chipKop}>
        {wedstrijd.resultaat === 'V' && <span className={styles.schedel}>💀</span>}
        {wedstrijd.resultaat} {wedstrijd.score}
        {/* Zonder dit leest "V 1–1" als een fout in plaats van als een
            bekeravond die op strafschoppen verloren ging. */}
        {wedstrijd.naStrafschoppen && <span className={styles.ns}> n.s.</span>}
      </span>
      <span className={styles.chipTegen} title={wedstrijd.tegenstanderNaam || undefined}>
        {wedstrijd.thuis ? '' : '@'}{tegenLabel(wedstrijd)}
      </span>
    </span>
  )
}

export default function Vloek({ onTerug }) {
  const [data, setData] = useState(null)
  const [laden, setLaden] = useState(true)
  const [fout, setFout] = useState(false)
  // 'beide' of een seizoensjaartal als tekst. Alle varianten komen in één
  // antwoord mee, dus wisselen kost geen nieuwe aanroep.
  const [keuze, setKeuze] = useState('beide')

  useEffect(() => {
    let gestopt = false
    async function laad() {
      setLaden(true)
      setFout(false)
      try {
        const r = await fetch('/api/h2h?vloek=1')
        const d = await r.json()
        if (!gestopt) setData(d)
      } catch (_) {
        if (!gestopt) setFout(true)
      }
      if (!gestopt) setLaden(false)
    }
    laad()
    return () => { gestopt = true }
  }, [])

  const kop = (
    <>
      <button className={styles.terug} onClick={onTerug}>‹ Terug naar klassement</button>
      <h2 className={styles.titel}>De PSV-vloek <span className={styles.schedelGroot}>💀</span></h2>
      <p className={styles.leus}>Wie PSV verslaat, betaalt de prijs. Toch?</p>
    </>
  )

  if (laden) return <div className={styles.wrapper}>{kop}<p className={styles.leeg}>Vloek wordt opgeroepen…</p></div>
  if (fout || data?.fout) {
    return (
      <div className={styles.wrapper}>
        {kop}
        <p className={styles.leeg}>De gegevens zijn nu niet op te halen. Probeer het later nog eens.</p>
      </div>
    )
  }

  const { varianten = {}, bronnen = [], seizoenen = [] } = data || {}
  const ontbreekt = bronnen.filter(b => b.reden || b.aantal === 0)

  // De knoppen: beide seizoenen plus elk seizoen apart, nieuwste eerst.
  const keuzes = [
    { waarde: 'beide', label: 'Beide' },
    ...[...seizoenen].sort((a, b) => b - a).map(j => ({ waarde: String(j), label: kort(j) })),
  ]

  const filter = (
    <div className={styles.filter} role="group" aria-label="Welk seizoen">
      {keuzes.map(k => (
        <button
          key={k.waarde}
          className={`${styles.filterKnop} ${keuze === k.waarde ? styles.filterAan : ''}`}
          onClick={() => setKeuze(k.waarde)}
          aria-pressed={keuze === k.waarde}
        >
          {k.label}
        </button>
      ))}
    </div>
  )

  const gekozen = varianten[keuze] || varianten.beide || {}
  const { rijen = [], samenvatting } = gekozen
  const periode = keuze === 'beide'
    ? `${seizoenen.length || 2} seizoenen`
    : kort(Number(keuze))

  if (rijen.length === 0 || !samenvatting) {
    return (
      <div className={styles.wrapper}>
        {kop}
        {keuzes.length > 1 && filter}
        <p className={styles.leeg}>
          Geen nederlagen gevonden in {periode}. Dat is of heel knap, of er
          ontbreekt iets — kijk hieronder.
        </p>
        <Bronnen bronnen={bronnen} />
      </div>
    )
  }

  // De vloek telt als echt wanneer de winnaars dáárna duidelijk minder punten
  // pakken dan ze normaal halen. Hun eigen gemiddelde is de maatstaf: wie van
  // PSV wint is vaak een goede ploeg, en dan zegt "weinig punten" pas iets als
  // je het daartegen afzet.
  const sterker = samenvatting.perWedstrijd !== null && samenvatting.normaalPerWedstrijd !== null
    && samenvatting.perWedstrijd < samenvatting.normaalPerWedstrijd - DREMPEL

  return (
    <div className={styles.wrapper}>
      {kop}
      {keuzes.length > 1 && filter}

      <div className={styles.samenvatting}>
        <div className={styles.hero}>
          <span className={styles.heroGetal}>{samenvatting.nederlagen}</span>
          <span className={styles.heroTekst}>
            {samenvatting.nederlagen === 1 ? 'nederlaag' : 'nederlagen'} in {periode}
            <br />Eredivisie en KNVB-beker
          </span>
        </div>

        {/* Punten in plaats van alleen nederlagen: een gelijkspel is twee
            punten laten liggen, en dat hoort mee te tellen. Hoe voller de
            balk, hoe meer er is blijven liggen. */}
        <p className={styles.balkKop}>Punten laten liggen</p>
        {samenvatting.per.map(p => (
          <div key={p.nr} className={styles.balkRij}>
            <span className={styles.balkLabel}>
              {p.nr === 1 ? 'de volgende' : `de ${p.nr}e daarna`}
            </span>
            <span className={styles.balkBaan}>
              <span
                className={styles.balkVulling}
                style={{ width: p.mogelijk > 0 ? `${(p.gelaten / p.mogelijk) * 100}%` : '0%' }}
              />
            </span>
            <span className={styles.balkCijfer}>{p.gelaten}/{p.mogelijk}</span>
          </div>
        ))}

        <p className={styles.oordeel}>
          {samenvatting.normaalPerWedstrijd === null ? (
            <>
              In die {samenvatting.kansen} wedstrijden pakten ze{' '}
              <strong>{samenvatting.gepakt} van de {samenvatting.mogelijk} punten</strong>.
              Nog te weinig gegevens om er een vloek bij te roepen.
            </>
          ) : sterker ? (
            <>
              In die {samenvatting.kansen} wedstrijden pakten ze{' '}
              <strong>{samenvatting.gepakt} van de {samenvatting.mogelijk} punten</strong> —{' '}
              {getal(samenvatting.perWedstrijd)} per duel, terwijl ze normaal{' '}
              {getal(samenvatting.normaalPerWedstrijd)} halen. Dat zijn{' '}
              {getal(samenvatting.tekort)} punten minder dan je zou verwachten.{' '}
              <strong>De vloek is echt.</strong>
            </>
          ) : (
            <>
              In die {samenvatting.kansen} wedstrijden pakten ze{' '}
              <strong>{samenvatting.gepakt} van de {samenvatting.mogelijk} punten</strong> —{' '}
              {getal(samenvatting.perWedstrijd)} per duel, en normaal halen ze{' '}
              {getal(samenvatting.normaalPerWedstrijd)}. <strong>Geen vloek, gewoon voetbal.</strong>
            </>
          )}
        </p>
      </div>

      <div className={styles.legenda}>
        <span><span className={`${styles.stip} ${styles.stipVerlies}`} />V = 0 punten</span>
        <span><span className={`${styles.stip} ${styles.stipGelijk}`} />G = 1 punt</span>
        <span><span className={`${styles.stip} ${styles.stipWinst}`} />W = 3 punten</span>
        <span className={styles.legendaUitleg}>gezien vanuit de club die van PSV won</span>
      </div>

      <h3 className={styles.lijstKop}>De nederlagen</h3>
      <div className={styles.lijst}>
        {rijen.map(rij => (
          <div key={`${rij.verlies.datumISO}-${rij.winnaar}`} className={styles.kaart}>
            <div className={styles.kaartMeta}>
              <span className={styles.seizoen}>{seizoenLabel(rij.verlies.datumISO)}</span>
              {rij.verlies.datum} · {COMPETITIE[rij.verlies.competitie] || rij.verlies.competitie}
            </div>
            <div className={styles.uitslag}>
              {rij.verlies.thuisNaam} <strong>{rij.verlies.home}–{rij.verlies.away}</strong> {rij.verlies.uitNaam}
              {rij.verlies.naStrafschoppen && <span className={styles.ns}> n.s.</span>}
            </div>
            <div className={styles.ernaKop}>
              {rij.winnaarNaam} daarna
              {rij.mogelijk > 0 && (
                <span className={styles.ernaPunten}>
                  {rij.gepakt} van {rij.mogelijk} punten
                </span>
              )}
            </div>
            <div className={styles.chips}>
              {rij.erna.length === 0
                ? <span className={styles.chipLeeg}>nog niets gespeeld</span>
                : rij.erna.map(w => <Chip key={w.datumISO} wedstrijd={w} />)}
            </div>
          </div>
        ))}
      </div>

      {ontbreekt.length > 0 && <Bronnen bronnen={bronnen} />}
    </div>
  )
}

// Wat er wel en niet binnenkwam. Zonder dit zou een ontbrekend seizoen er
// uitzien als "PSV verloor toen niets", en dat is een leugen met een glimlach.
function Bronnen({ bronnen }) {
  return (
    <details className={styles.bronBlok}>
      <summary className={styles.bronKop}>Welke gegevens zitten hierin?</summary>
      <ul className={styles.bronLijst}>
        {bronnen.map(b => (
          <li key={`${b.seizoen}-${b.competitie}`}>
            {COMPETITIE[b.competitie] || b.competitie} {b.seizoen}/{String(b.seizoen + 1).slice(2)}:{' '}
            {b.aantal > 0 ? `${b.aantal} wedstrijden` : 'niets'}
            {b.reden ? ` — ${b.reden}` : ''}
          </li>
        ))}
      </ul>
    </details>
  )
}
