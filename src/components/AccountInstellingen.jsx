import { useState } from 'react'
import styles from './AccountInstellingen.module.css'

const SESSION_KEY = 'psv_session_token'

export default function AccountInstellingen({ speler, onSluiten }) {
  const [tab, setTab] = useState('pincode')
  const [laden, setLaden] = useState(false)
  const [melding, setMelding] = useState(null)

  const [huidigePincode, setHuidigePincode] = useState('')
  const [nieuwePincode, setNieuwePincode] = useState('')
  const [nieuwePincodeHerhaal, setNieuwePincodeHerhaal] = useState('')

  const [emailHuidigePincode, setEmailHuidigePincode] = useState('')
  const [nieuwEmail, setNieuwEmail] = useState('')
  const [nieuwEmailHerhaal, setNieuwEmailHerhaal] = useState('')

  async function handleWijzigPincode() {
    if (huidigePincode.length !== 4 || nieuwePincode.length !== 4) {
      setMelding({ type: 'fout', tekst: 'Vul beide pincodes volledig in' })
      return
    }
    if (nieuwePincode !== nieuwePincodeHerhaal) {
      setMelding({ type: 'fout', tekst: 'Nieuwe pincodes komen niet overeen' })
      return
    }
    setLaden(true)
    setMelding(null)
    try {
      const sessionToken = localStorage.getItem(SESSION_KEY)
      const r = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'wijzig-pincode', sessionToken,
          huidigePincode, nieuwePincode, nieuwePincodeHerhaal,
        })
      })
      const data = await r.json()
      if (data.success) {
        setMelding({ type: 'ok', tekst: data.message })
        setHuidigePincode(''); setNieuwePincode(''); setNieuwePincodeHerhaal('')
      } else {
        setMelding({ type: 'fout', tekst: data.error })
      }
    } catch (e) {
      setMelding({ type: 'fout', tekst: 'Er ging iets mis. Probeer het opnieuw.' })
    } finally {
      setLaden(false)
    }
  }

  async function handleVraagEmailWijzigingAan() {
    if (emailHuidigePincode.length !== 4) {
      setMelding({ type: 'fout', tekst: 'Vul je huidige pincode in' })
      return
    }
    if (!nieuwEmail || nieuwEmail.toLowerCase().trim() !== nieuwEmailHerhaal.toLowerCase().trim()) {
      setMelding({ type: 'fout', tekst: 'E-mailadressen komen niet overeen' })
      return
    }
    setLaden(true)
    setMelding(null)
    try {
      const sessionToken = localStorage.getItem(SESSION_KEY)
      const r = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'vraag-email-wijziging-aan', sessionToken,
          huidigePincode: emailHuidigePincode, nieuwEmail, nieuwEmailHerhaal,
        })
      })
      const data = await r.json()
      if (data.success) {
        setMelding({ type: 'ok', tekst: data.message })
        setEmailHuidigePincode(''); setNieuwEmail(''); setNieuwEmailHerhaal('')
      } else {
        setMelding({ type: 'fout', tekst: data.error })
      }
    } catch (e) {
      setMelding({ type: 'fout', tekst: 'Er ging iets mis. Probeer het opnieuw.' })
    } finally {
      setLaden(false)
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3 className={styles.titel}>Account — {speler.naam}</h3>
          <button className={styles.sluitBtn} onClick={onSluiten}>✕</button>
        </div>

        <div className={styles.tabBar}>
          <button
            className={`${styles.tabBtn} ${tab === 'pincode' ? styles.tabActief : ''}`}
            onClick={() => { setTab('pincode'); setMelding(null) }}
          >
            Pincode
          </button>
          <button
            className={`${styles.tabBtn} ${tab === 'email' ? styles.tabActief : ''}`}
            onClick={() => { setTab('email'); setMelding(null) }}
          >
            E-mail
          </button>
        </div>

        {melding && (
          <div className={`${styles.melding} ${melding.type === 'ok' ? styles.meldingOk : styles.meldingFout}`}>
            {melding.tekst}
          </div>
        )}

        {tab === 'pincode' && (
          <div className={styles.form}>
            <label className={styles.label}>Huidige pincode</label>
            <input
              className={styles.inputPincode}
              type="tel" inputMode="numeric" maxLength={4}
              value={huidigePincode}
              onChange={e => setHuidigePincode(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••"
            />
            <label className={styles.label}>Nieuwe pincode</label>
            <input
              className={styles.inputPincode}
              type="tel" inputMode="numeric" maxLength={4}
              value={nieuwePincode}
              onChange={e => setNieuwePincode(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••"
            />
            <label className={styles.label}>Herhaal nieuwe pincode</label>
            <input
              className={styles.inputPincode}
              type="tel" inputMode="numeric" maxLength={4}
              value={nieuwePincodeHerhaal}
              onChange={e => setNieuwePincodeHerhaal(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••"
            />
            <button className={styles.btn} onClick={handleWijzigPincode} disabled={laden}>
              {laden ? 'Bezig…' : 'Pincode wijzigen'}
            </button>
          </div>
        )}

        {tab === 'email' && (
          <div className={styles.form}>
            <p className={styles.uitleg}>
              Je ontvangt een bevestigingslink op je nieuwe e-mailadres. Het wijzigt pas na het klikken op die link.
            </p>
            <label className={styles.label}>Huidige pincode</label>
            <input
              className={styles.inputPincode}
              type="tel" inputMode="numeric" maxLength={4}
              value={emailHuidigePincode}
              onChange={e => setEmailHuidigePincode(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••"
            />
            <label className={styles.label}>Nieuw e-mailadres</label>
            <input
              className={styles.input}
              type="email"
              value={nieuwEmail}
              onChange={e => setNieuwEmail(e.target.value)}
              placeholder="naam@voorbeeld.nl"
              autoCapitalize="none"
            />
            <label className={styles.label}>Herhaal nieuw e-mailadres</label>
            <input
              className={styles.input}
              type="email"
              value={nieuwEmailHerhaal}
              onChange={e => setNieuwEmailHerhaal(e.target.value)}
              placeholder="naam@voorbeeld.nl"
              autoCapitalize="none"
            />
            <button className={styles.btn} onClick={handleVraagEmailWijzigingAan} disabled={laden}>
              {laden ? 'Bezig…' : 'Verificatielink versturen'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
