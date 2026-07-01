import styles from './Header.module.css'

export default function Header({ speler, onWissel }) {
  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <span className={styles.logo}>PSV</span>
        <span className={styles.appName}>Poule</span>
      </div>
      <button className={styles.spelerBtn} onClick={onWissel}>
        <span className={styles.spelerLabel}>
          {speler === 'niek' ? 'Niek' : 'Huub'}
        </span>
        <span className={styles.wisselIcon}>⇄</span>
      </button>
    </header>
  )
}
