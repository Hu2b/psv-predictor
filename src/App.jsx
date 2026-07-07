import { useState, useEffect, useCallback } from 'react'
import AuthScreen from './components/AuthScreen.jsx'
import NextMatch from './components/NextMatch.jsx'
import Header from './components/Header.jsx'
import Admin from './components/Admin.jsx'
import styles from './App.module.css'

const StandingsLazy = ({ fixtures, speler }) => {
  const [Comp, setComp] = useState(null)
  useEffect(() => {
    import('./components/Standings.jsx').then(m => setComp(() => m.default))
  }, [])
  if (!Comp) return <div style={{padding:'40px',textAlign:'center',color:'#666'}}>Laden…</div>
  return <Comp fixtures={fixtures} speler={speler} />
}

const SESSION_KEY = 'psv_session_token'

export default function App() {
  const [speler, setSpeler] = useState(null)
  const [sessieControleGedaan, setSessieControleGedaan] = useState(false)
  const [tab, setTab] = useState('wedstrijd')
  const [fixtures, setFixtures] = useState([])
  const [season, setSeason] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function controleerSessie() {
      const token = localStorage.getItem(SESSION_KEY)
      if (!token) {
        setSessieControleGedaan(true)
        return
      }
      try {
        const r = await fetch(`/api/auth?action=sessie&sessionToken=${encodeURIComponent(token)}`)
        const data = await r.json()
        if (data.success) {
          setSpeler(data.speler)
        } else {
          localStorage.removeItem(SESSION_KEY)
        }
      } catch (e) {
        localStorage.removeItem(SESSION_KEY)
      } finally {
        setSessieControleGedaan(true)
      }
    }
    controleerSessie()
  }, [])

  const laadWedstrijden = useCallback(async () => {
    try {
      const r = await fetch('/api/fixtures')
      const data = await r.json()
      if (data.fixtures) setFixtures(data.fixtures)
      if (data.season) setSeason(data.season)
      setError(null)
    } catch (e) {
      setError('Kan wedstrijden niet laden.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (speler) laadWedstrijden()
  }, [speler, laadWedstrijden])

  function handleIngelogd(nieuweSpeler, sessionToken) {
    localStorage.setItem(SESSION_KEY, sessionToken)
    setSpeler(nieuweSpeler)
  }

  async function handleUitloggen() {
    const token = localStorage.getItem(SESSION_KEY)
    if (token) {
      try {
        await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'uitloggen', sessionToken: token })
        })
      } catch (e) {}
    }
    localStorage.removeItem(SESSION_KEY)
    setSpeler(null)
    setTab('wedstrijd')
  }

  function bepaalGetoondeWedstrijd() {
    if (fixtures.length === 0) return null
    const nogTeSpelen = fixtures.find(f => !['FT','AET','PEN'].includes(f.status))
    if (nogTeSpelen) return nogTeSpelen
    return fixtures[fixtures.length - 1]
  }

  const getoondeWedstrijd = bepaalGetoondeWedstrijd()

  if (!sessieControleGedaan) {
    return (
      <div className={styles.loadingState}>
        <div className="spinner" />
      </div>
    )
  }

  if (!speler) return <AuthScreen onIngelogd={handleIngelogd} />

  return (
    <div className={styles.app}>
      <Header speler={speler} onUitloggen={handleUitloggen} season={season} />
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
        {speler.isAdmin && (
          <button
            className={`${styles.tab} ${tab === 'admin' ? styles.tabActive : ''}`}
            onClick={() => setTab('admin')}
          >
            ⚙️ Admin
          </button>
        )}
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
          <NextMatch fixture={getoondeWedstrijd} fixtures={fixtures} speler={speler.naam} />
        ) : tab === 'totaal' ? (
          <StandingsLazy fixtures={fixtures} speler={speler.naam} />
        ) : speler.isAdmin ? (
          <Admin fixtures={fixtures} onWedstrijdenGewijzigd={laadWedstrijden} />
        ) : null}
      </main>
    </div>
  )
}
