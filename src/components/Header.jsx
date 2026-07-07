import styles from './Header.module.css'
import { zoekLogo } from '../../shared/teams.js'

function formatSeizoen(season) {
  if (!season) return ''
  const kort = n => String(n).slice(-2)
  return `${kort(season)}/${kort(season + 1)}`
}

export default function Header({ speler, onUitloggen, season }) {
  const psvLogo = zoekLogo('PSV')

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        {psvLogo && (
          <img
            src={psvLogo}
            alt="PSV"
            className={styles.logoImg}
            onError={e => { e.target.style.display = 'none' }}
          />
        )}
        <span className={styles.appName}>PSV Poule</span>
        {season && <span className={styles.seizoen}>{formatSeizoen(season)}</span>}
      </div>
      <button className={styles.spelerBtn} onClick={onUitloggen}>
        <span className={styles.spelerLabel}>{speler.naam}</span>
        <span className={styles.wisselIcon}>⏻</span>
      </button>
    </header>
  )
}
