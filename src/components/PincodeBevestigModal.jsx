import { useState } from 'react'
import styles from './PincodeBevestigModal.module.css'

export default function PincodeBevestigModal({ titel, omschrijving, onBevestig, onAnnuleer, laden }) {
  const [pincode, setPincode] = useState('')

  function handleBevestig() {
    if (pincode.length !== 4) return
    onBevestig(pincode)
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h3 className={styles.titel}>{titel}</h3>
        <p className={styles.omschrijving}>{omschrijving}</p>
        <label className={styles.label}>Jouw pincode</label>
        <input
          className={styles.inputPincode}
          type="tel"
          inputMode="numeric"
          maxLength={4}
          autoFocus
          value={pincode}
          onChange={e => setPincode(e.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder="••••"
        />
        <div className={styles.btnRij}>
          <button className={styles.annuleerBtn} onClick={onAnnuleer} disabled={laden}>
            Annuleren
          </button>
          <button className={styles.bevestigBtn} onClick={handleBevestig} disabled={laden || pincode.length !== 4}>
            {laden ? 'Bezig…' : 'Bevestigen'}
          </button>
        </div>
      </div>
    </div>
  )
}
