import { useState, useEffect } from 'react'
import PlayerSelect from './components/PlayerSelect.jsx'
import NextMatch from './components/NextMatch.jsx'
import Header from './components/Header.jsx'
import styles from './App.module.css'

const StandingsLazy = ({ fixtures, speler }) => {
  const [Comp, setComp] = useState(null)
  useEffect(() => {
    import('./components/Standings.jsx').then(m => setComp(() => m.default))
  }, [])
  if (!Comp) return <div style={{padding:'40px',textAlign:'center',color:'#666'}}>Laden…</div>
  return <Comp fixtures={fixtures} speler={speler} />
}

export default function App() {
  const [speler, setSpeler] = useState(() => localStorage.getItem('psv_speler') || null)
  const [tab, setTab] = useState('wedstrijd')
  const [fixtures, setFixtures] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function laadWedstrijden() {
      try {
        const r = await fetch('/api/fixtures')
        const data = await r.json()
        if (data.fixtures) setFixtures(data.fixtures)
      } catch (e) {
        setError('Kan wedstrijden niet laden.')
      } finally {
        setLoading(false)
      }
    }
    laadWedstrijden()
  }, [])

  function handleSpelerKeuze(naam) {
    localStorage.setItem('psv_speler', naam)
    setSpeler(naam)
  }

  function handleWisselSpeler() {
    localStorage.removeItem('psv_speler')
    setSpeler(null)
  }

  // Eerstvolgende nog te spelen wedstrijd (status niet FT/AET/PEN)
  // Als alles gespeeld is: toon de laatst gespeelde wedstrijd
  function bepaalGetoondeWedstrijd() {
    if (fixtures.length === 0) return null
    const nogTeSpelen = fixtures.find(f => !['FT','AET','PEN'].includes(f.status))
    if (nogTeSpelen) return nogTeSpelen
    return fixtures[fixtures.length - 1]
  }

  const getoondeWedstrijd = bepaalGetoondeWedstrijd()

  if (!speler) return <PlayerSelect onKeuze={handleSpelerKeuze} />

  return (
    <div className={styles.app}>
      <Header speler={speler} onWissel={handleWisselSpeler} />
      <nav className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === 'wedstrijd' ? styles.tabActive : ''}`}
          onClick={() => setTab('wedstrijd')}
        >
          ⚽ Wedstrijd
        </button>
        <button
          className={`${styles.tab} ${tab === 'totaal' ? styles.tabActive : ''}`}
          onClick={() => setTab('totaal')}
        >
          🏆 Totaal
        </button>
      </nav>
      <main className={styles.main}>
        {loading ? (
          <div className={styles.loadingState}>
            <div className="spinner" />
            <p>Wedstrijden laden…</p>
          </div>
        ) : error ? (
          <div className={styles.errorState}>
            <p>{error}</p>
            <button onClick={() => window.location.reload()} className={styles.retryBtn}>
              Opnieuw proberen
            </button>
          </div>
        ) : tab === 'wedstrijd' ? (
          <NextMatch fixture={getoondeWedstrijd} fixtures={fixtures} speler={speler} />
        ) : (
          <StandingsLazy fixtures={fixtures} speler={speler} />
        )}
      </main>
    </div>
  )
}
