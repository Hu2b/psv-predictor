import styles from './PlayerSelect.module.css'

export default function PlayerSelect({ onKeuze }) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.hero}>
        <div className={styles.badge}>PSV</div>
        <h1 className={styles.title}>Predictor</h1>
        <p className={styles.sub}>Wie ben jij?</p>
      </div>
      <div className={styles.keuzes}>
        <button className={styles.spelerBtn} onClick={() => onKeuze('niek')}>
          <span className={styles.spelerNaam}>Niek</span>
          <span className={styles.spelerArrow}>→</span>
        </button>
        <button className={styles.spelerBtn} onClick={() => onKeuze('huub')}>
          <span className={styles.spelerNaam}>Huub</span>
          <span className={styles.spelerArrow}>→</span>
        </button>
      </div>
      <p className={styles.hint}>Kies je naam om voorspellingen te doen</p>
    </div>
  )
}
