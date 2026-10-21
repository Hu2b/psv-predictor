import { useState, useEffect } from 'react'
import styles from './Admin.module.css'
import { getSessionToken } from '../lib/sessie.js'

export default function AdminMeldingen({ setMelding }) {
  const [instellingen, setInstellingen] = useState(null)
  const [laden, setLaden] = useState(true)
  const [bezig, setBezig] = useState(false)
  const [uitslag, setUitslag] = useState(null)

  async function laadInstellingen() {
    setLaden(true)
    try {
      const sessionToken = getSessionToken()
      const r = await fetch(`/api/admin?action=meldinginstellingen&sessionToken=${encodeURIComponent(sessionToken)}`)
      const data = await r.json()
      setInstellingen(data)
    } catch (_) {}
    setLaden(false)
  }

  useEffect(() => { laadInstellingen() }, [])

  async function stuurTest() {
    setBezig(true)
    setUitslag(null)
    try {
      const r = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'testMelding', sessionToken: getSessionToken() })
      })
      const data = await r.json()
      setUitslag(data)
      setMelding(data.success
        ? { type: 'ok', tekst: `Proefbericht verstuurd via ${data.kanaal}` }
        : { type: 'fout', tekst: 'Proefbericht mislukt — zie details hieronder' })
    } catch (_) {
      setUitslag({ success: false, error: 'Netwerkfout' })
      setMelding({ type: 'fout', tekst: 'Netwerkfout' })
    }
    setBezig(false)
  }

  if (laden) return <div className={styles.sectie}><p className={styles.leegTekst}>Laden…</p></div>

  const wa = instellingen?.whatsapp || {}

  return (
    <div className={styles.sectie}>
      <label className={styles.label}>Meldingen</label>
      <p className={styles.leegTekst}>
        Na elke verwerkte uitslag krijgen spelers automatisch de eindstand, hun
        eigen voorspelling en het nieuwe klassement. Hieronder zie je welk
        kanaal daarvoor gebruikt wordt, en kun je het testen.
      </p>

      <div className={styles.predBlok}>
        <div className={styles.predRij}>
          <div className={styles.predInfo}>
            <span className={styles.predNaam}>Kanaal nu</span>
          </div>
          <span className={styles.predScore}>
            {instellingen?.kanaalVoorJou === 'whatsapp' ? 'WhatsApp' : 'E-mail'}
          </span>
        </div>

        <div className={styles.predRij}>
          <div className={styles.predInfo}>
            <span className={styles.predNaam}>WhatsApp-token</span>
          </div>
          <span className={styles.predScore}>{wa.tokenAanwezig ? '✅' : '—'}</span>
        </div>

        <div className={styles.predRij}>
          <div className={styles.predInfo}>
            <span className={styles.predNaam}>Phone Number ID</span>
          </div>
          <span className={styles.predScore}>{wa.phoneNumberIdAanwezig ? '✅' : '—'}</span>
        </div>

        <div className={styles.predRij}>
          <div className={styles.predInfo}>
            <span className={styles.predNaam}>Sjabloon</span>
          </div>
          <span className={styles.predLeeg}>{wa.sjabloon} ({wa.taal})</span>
        </div>

        <div className={styles.predRij}>
          <div className={styles.predInfo}>
            <span className={styles.predNaam}>Jouw nummer</span>
          </div>
          <span className={styles.predLeeg}>
            {instellingen?.jouwTelefoon || 'niet ingevuld — zie Account → Meldingen'}
          </span>
        </div>
      </div>

      {!wa.ingesteld && (
        <p className={styles.leegTekst}>
          ℹ️ WhatsApp is nog niet ingesteld, dus meldingen gaan per e-mail. Zet
          WHATSAPP_TOKEN en WHATSAPP_PHONE_NUMBER_ID in Vercel om over te
          schakelen. De volledige instructie staat in de README.
        </p>
      )}

      <button className={styles.btn} onClick={stuurTest} disabled={bezig}>
        {bezig ? 'Bezig…' : 'Stuur mij een proefbericht'}
      </button>

      {uitslag && (
        <div className={styles.predBlok}>
          {uitslag.success ? (
            <p className={styles.leegTekst}>
              ✅ Verstuurd via <strong>{uitslag.kanaal}</strong> naar {uitslag.naar}.
              Niets ontvangen? Controleer bij WhatsApp of je nummer is aangemeld
              en of het sjabloon is goedgekeurd.
            </p>
          ) : (
            <>
              <p className={styles.leegTekst}>❌ Mislukt via {uitslag.kanaal}. Foutmelding:</p>
              <pre className={styles.foutDetail}>{uitslag.error}</pre>
            </>
          )}
        </div>
      )}
    </div>
  )
}
