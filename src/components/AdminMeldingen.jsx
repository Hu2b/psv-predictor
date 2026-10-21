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
            <span className={styles.predNaam}>Twilio Account SID</span>
          </div>
          <span className={styles.predScore}>{wa.accountAanwezig ? '✅' : '—'}</span>
        </div>

        <div className={styles.predRij}>
          <div className={styles.predInfo}>
            <span className={styles.predNaam}>Twilio Auth Token</span>
          </div>
          <span className={styles.predScore}>{wa.tokenAanwezig ? '✅' : '—'}</span>
        </div>

        <div className={styles.predRij}>
          <div className={styles.predInfo}>
            <span className={styles.predNaam}>Afzender</span>
          </div>
          <span className={styles.predLeeg}>{wa.afzender || '—'}</span>
        </div>

        <div className={styles.predRij}>
          <div className={styles.predInfo}>
            <span className={styles.predNaam}>Sjabloon</span>
          </div>
          <span className={styles.predLeeg}>{wa.sjabloon || '— vrije tekst'}</span>
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

      {wa.ingesteld && wa.modus === 'vrije tekst' && (
        <p className={styles.leegTekst}>
          ⚠️ Er is geen goedgekeurd sjabloon ingesteld, dus berichten gaan als
          vrije tekst. WhatsApp levert die alleen af binnen 24 uur nadat de
          ontvanger zelf iets stuurde — genoeg om te testen, niet genoeg voor
          het seizoen. Zet TWILIO_CONTENT_SID zodra je sjabloon goedgekeurd is.
        </p>
      )}

      {!wa.ingesteld && (
        <p className={styles.leegTekst}>
          ℹ️ WhatsApp is nog niet ingesteld, dus meldingen gaan per e-mail.
          Hierboven zie je met een ✅ of — wat er nog ontbreekt. Zet in Vercel
          (Settings → Environment Variables) de vier waarden TWILIO_ACCOUNT_SID,
          TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM en TWILIO_CONTENT_SID, en
          deploy daarna opnieuw — omgevingsvariabelen worden alleen bij het
          bouwen ingeladen.
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
              <br />Gebaseerd op: {uitslag.gebaseerdOp}
              {!uitslag.echteData && ' (zodra er een uitslag verwerkt is, gebruikt de test die echte wedstrijd)'}
              <br />Niets ontvangen? Controleer bij WhatsApp of je nummer is aangemeld
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
