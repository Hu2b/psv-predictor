<div className={styles.tabBar}>
  <button className={`${styles.tabBtn} ${tab === 'uitslag' ? styles.tabActief : ''}`} onClick={() => setTab('uitslag')}>Uitslag</button>
  <button className={`${styles.tabBtn} ${tab === 'toevoegen' ? styles.tabActief : ''}`} onClick={() => setTab('toevoegen')}>Toevoegen</button>
  <button className={`${styles.tabBtn} ${tab === 'beheer' ? styles.tabActief : ''}`} onClick={() => setTab('beheer')}>Beheer</button>
</div>
