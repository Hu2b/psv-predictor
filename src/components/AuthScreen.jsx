import { useState, useEffect } from 'react'
import styles from './AuthScreen.module.css'

export default function AuthScreen({ onIngelogd }) {
  const [modus, setModus] = useState('login') // login | registreren | vergeten | reset | verifyResultaat
  const [laden, setLaden] = useState(false)
  const [melding, setMelding] = useState(null)
  const [resetToken, setResetToken] = useState(null)

  // Login-formulier
  const [loginNaam, setLoginNaam] = useState('')
  const [loginPincode, setLoginPincode] = useState('')

  // Registratie-formulier
  const [regEmail, setRegEmail] = useState('')
  const [regEmailHerhaal, setRegEmailHerhaal] = useState('')
  const [regNaam, setRegNaam] = useState('')
  const [regPincode, setRegPincode] = useState('')
  const [regPincodeHerhaal, setRegPincodeHerhaal] = useState('')

  // Pincode vergeten
  const [vergetenEmail, setVergetenEmail] = useState('')

  // Nieuwe pincode instellen (via reset-link)
  const [nieuwePincode, setNieuwePincode] = useState('')
  const [nieuwePincodeHerhaal, setNieuwePincodeHerhaal] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const verifyToken = params.get('verify')
    const rToken = params.get('reset')

    if (verifyToken) {
      verifieerEmail(verifyToken)
    } else if (rToken) {
      setResetToken(rToken)
      setModus('reset')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function verifieerEmail(token) {
    setLaden(true)
    setMelding(null)
    try {
      const r = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', token })
      })
      const data = await r.json()
      if (data.success) {
        setMelding({ type: 'ok', tekst: data.message })
      } else {
        setMelding({ type: 'fout', tekst: data.error })
      }
      setModus('verifyResultaat')
    } catch (e) {
      setMelding({ type: 'fout', tekst: 'Er ging iets mis. Probeer het opnieuw.' })
      setModus('verifyResultaat')
    } finally {
      setLaden(false)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }

  async function handleLogin() {
    if (!loginNaam.trim() || loginPincode.length !== 4) {
      setMelding({ type: 'fout', tekst: 'Vul naam en 4-cijferige pincode in' })
      return
    }
    setLaden(true)
    setMelding(null)
    try {
      const r = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', naam: loginNaam.trim(), pincode: loginPincode })
      })
      const data = await r.json()
      if (data.success) {
        onIngelogd(data.speler, data.sessionToken)
      } else {
        setMelding({ type: 'fout', tekst: data.error })
      }
    } catch (e) {
      setMelding({ type: 'fout', tekst: 'Er ging iets mis. Probeer het opnieuw.' })
    } finally {
      setLaden(false)
    }
  }

  async function handleRegistreren() {
    if (!regEmail || !regEmailHerhaal || !regNaam || !regPincode || !regPincodeHerhaal) {
      setMelding({ type: 'fout', tekst: 'Vul alle velden in' })
      return
    }
    setLaden(true)
    setMelding(null)
    try {
      const r = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register',
          email: regEmail.trim(),
          emailHerhaal: regEmailHerhaal.trim(),
          naam: regNaam.trim(),
          pincode: regPincode,
          pincodeHerhaal: regPincodeHerhaal,
        })
      })
      const data = await r.json()
      if (data.success) {
        setMelding({ type: 'ok', tekst: data.message })
        setRegEmail(''); setRegEmailHerhaal(''); setRegNaam('')
        setRegPincode(''); setRegPincodeHerhaal('')
      } else {
        setMelding({ type: 'fout', tekst: data.error })
      }
    } catch (e) {
      setMelding({ type: 'fout', tekst: 'Er ging iets mis. Probeer het opnieuw.' })
    } finally {
      setLaden(false)
    }
  }

  async function handleVraagResetAan() {
    if (!vergetenEmail.trim()) {
      setMelding({ type: 'fout', tekst: 'Vul je e-mailadres in' })
      return
    }
    setLaden(true)
    setMelding(null)
    try {
      const r = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'vraag-reset-aan', email: vergetenEmail.trim() })
      })
      const data = await r.json()
      setMelding({ type: data.success ? 'ok' : 'fout', tekst: data.message || data.error })
    } catch (e) {
      setMelding({ type: 'fout', tekst: 'Er ging iets mis. Probeer het opnieuw.' })
    } finally {
      setLaden(false)
    }
  }

  async function handleNieuwePincodeInstellen() {
    if (nieuwePincode.length !== 4) {
      setMelding({ type: 'fout', tekst: 'Pincode moet uit 4 cijfers bestaan' })
      return
    }
    if (nieuwePincode !== nieuwePincodeHerhaal) {
      setMelding({ type: 'fout', tekst: 'Pincodes komen niet overeen' })
      return
    }
    setLaden(true)
    setMelding(null)
    try {
      const r = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset-pincode',
          token: resetToken,
          pincode: nieuwePincode,
          pincodeHerhaal: nieuwePincodeHerhaal,
        })
      })
      const data = await r.json()
      if (data.success) {
        setMelding({ type: 'ok', tekst: data.message })
        setModus('login')
        setResetToken(null)
      } else {
        setMelding({ type: 'fout', tekst: data.error })
      }
    } catch (e) {
      setMelding({ type: 'fout', tekst: 'Er ging iets mis. Probeer het opnieuw.' })
    } finally {
      setLaden(false)
    }
  }

  function wisselModus(nieuw) {
    setModus(nieuw)
    setMelding(null)
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.kaart}>
        <h1 className={styles.titel}>PSV Poule</h1>

        {modus !== 'reset' && modus !== 'verifyResultaat' && (
          <div className={styles.tabBar}>
            <button
              className={`${styles.tabBtn} ${modus === 'login' ? styles.tabActief : ''}`}
              onClick={() => wisselModus('login')}
            >
              Inloggen
            </button>
            <button
              className={`${styles.tabBtn} ${modus === 'registreren' ? styles.tabActief : ''}`}
              onClick={() => wisselModus('registreren')}
            >
              Registreren
            </button>
          </div>
        )}

        {melding && (
          <div className={`${styles.melding} ${melding.type === 'ok' ? styles.meldingOk : styles.meldingFout}`}>
            {melding.tekst}
          </div>
        )}

        {modus === 'login' && (
          <div className={styles.form}>
            <label className={styles.label}>Spelernaam</label>
            <input
              className={styles.input}
              value={loginNaam}
              onChange={e => setLoginNaam(e.target.value)}
              placeholder="Niek"
              autoCapitalize="words"
            />
            <label className={styles.label}>Pincode</label>
            <input
              className={styles.inputPincode}
              type="tel"
              inputMode="numeric"
              maxLength={4}
              value={loginPincode}
              onChange={e => setLoginPincode(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••"
            />
            <button className={styles.btn} onClick={handleLogin} disabled={laden}>
              {laden ? 'Bezig…' : 'Inloggen'}
            </button>
            <button className={styles.linkBtn} onClick={() => wisselModus('vergeten')}>
              Pincode vergeten?
            </button>
          </div>
        )}

        {modus === 'registreren' && (
          <div className={styles.form}>
            <label className={styles.label}>E-mailadres</label>
            <input
              className={styles.input}
              type="email"
              value={regEmail}
              onChange={e => setRegEmail(e.target.value)}
              placeholder="naam@voorbeeld.nl"
              autoCapitalize="none"
            />
            <label className={styles.label}>Herhaal e-mailadres</label>
            <input
              className={styles.input}
              type="email"
              value={regEmailHerhaal}
              onChange={e => setRegEmailHerhaal(e.target.value)}
              placeholder="naam@voorbeeld.nl"
              autoCapitalize="none"
            />
            <label className={styles.label}>Spelernaam</label>
            <input
              className={styles.input}
              value={regNaam}
              onChange={e => setRegNaam(e.target.value)}
              placeholder="Niek"
              autoCapitalize="words"
            />
            <label className={styles.label}>Pincode (4 cijfers)</label>
            <input
              className={styles.inputPincode}
              type="tel"
              inputMode="numeric"
              maxLength={4}
              value={regPincode}
              onChange={e => setRegPincode(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••"
            />
            <label className={styles.label}>Herhaal pincode</label>
            <input
              className={styles.inputPincode}
              type="tel"
              inputMode="numeric"
              maxLength={4}
              value={regPincodeHerhaal}
              onChange={e => setRegPincodeHerhaal(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••"
            />
            <button className={styles.btn} onClick={handleRegistreren} disabled={laden}>
              {laden ? 'Bezig…' : 'Account aanmaken'}
            </button>
          </div>
        )}

        {modus === 'vergeten' && (
          <div className={styles.form}>
            <p className={styles.uitleg}>
              Vul je e-mailadres in. Als dit adres bekend is, ontvang je een link om een nieuwe pincode in te stellen.
            </p>
            <label className={styles.label}>E-mailadres</label>
            <input
              className={styles.input}
              type="email"
              value={vergetenEmail}
              onChange={e => setVergetenEmail(e.target.value)}
              placeholder="naam@voorbeeld.nl"
              autoCapitalize="none"
            />
            <button className={styles.btn} onClick={handleVraagResetAan} disabled={laden}>
              {laden ? 'Bezig…' : 'Verstuur link'}
            </button>
            <button className={styles.linkBtn} onClick={() => wisselModus('login')}>
              Terug naar inloggen
            </button>
          </div>
        )}

        {modus === 'reset' && (
          <div className={styles.form}>
            <p className={styles.uitleg}>Stel een nieuwe pincode in.</p>
            <label className={styles.label}>Nieuwe pincode</label>
            <input
              className={styles.inputPincode}
              type="tel"
              inputMode="numeric"
              maxLength={4}
              value={nieuwePincode}
              onChange={e => setNieuwePincode(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••"
            />
            <label className={styles.label}>Herhaal nieuwe pincode</label>
            <input
              className={styles.inputPincode}
              type="tel"
              inputMode="numeric"
              maxLength={4}
              value={nieuwePincodeHerhaal}
              onChange={e => setNieuwePincodeHerhaal(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••"
            />
            <button className={styles.btn} onClick={handleNieuwePincodeInstellen} disabled={laden}>
              {laden ? 'Bezig…' : 'Pincode instellen'}
            </button>
          </div>
        )}

        {modus === 'verifyResultaat' && (
          <div className={styles.form}>
            <button className={styles.btn} onClick={() => wisselModus('login')}>
              Naar inloggen
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
