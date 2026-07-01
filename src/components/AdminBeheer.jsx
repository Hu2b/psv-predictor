import { useState } from 'react'
import styles from './Admin.module.css'
import AdminVoorspellingen from './AdminVoorspellingen.jsx'

const COMPETITIES = ['JCS', 'ERE', 'KNVB', 'CL', 'UL']
const TEAM_NAMEN = {
  'PSV': 'PSV Eindhoven', 'AJX': 'Ajax', 'FEY': 'Feyenoord',
  'AZ': 'AZ Alkmaar', 'UTR': 'FC Utrecht', 'TWE': 'FC Twente',
  'NEC': 'NEC Nijmegen', 'HEE': 'sc Heerenveen', 'GRO': 'FC Groningen',
  'ALM': 'Almere City FC', 'SPA': 'Sparta Rotterdam', 'GAE': 'Go Ahead Eagles',
  'RKC': 'RKC Waalwijk', 'PEC': 'PEC Zwolle', 'FOR': 'Fortuna Sittard',
  'WIL': 'Willem II', 'NAC': 'NAC Breda', 'HER': 'Heracles Almelo',
  'EXC': 'Excelsior', 'VOL': 'FC Volendam', 'TEL': 'Telstar 1963',
  'ADO': 'ADO Den Haag', 'BAR': 'FC Barcelona', 'REA': 'Real Madrid',
  'MCI': 'Manchester City', 'LIV': 'Liverpool FC', 'BAY': 'Bayern München',
  'BOR': 'Borussia Dortmund',
}

export default function AdminBeheer({ handmatig, setHandmatig, setMelding, alleWedstrijden }) {
  const [wijzigenId, setWijzigenId] = useState(null)
  const [wijzigenData, setWijzigenData] = useState({})

  function toLocalInput(isoStr) {
    if (!isoStr) return ''
    const d = new Date(isoStr)
    const pad = n => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  function startWijzigen(w) {
    setWijzigenId(w.matchId)
    setWijzigenData({
      competitie: w.competitie,
      thuis: w.thuis,
      thuisNaam: w.thuisNaam || '',
      uit: w.uit,
      uitNaam: w.uitNaam || '',
      datumISO: toLocalInput(w.datumISO),
    })
  }

  async function handleWijzigen() {
    const datumISO = new Date(wijzigenData.datumISO).toISOString()
    const datumLabel = new Date(wijzigenData.datumISO).toLocaleDateString('nl-NL', {
      weekday:'short', day:'numeric', month:'short', year:'numeric'
    })
    const r = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'wijzigen', matchId: wijzigenId, ...wijzigenData, datum: datumLabel, datumISO })
    })
    const data = await r.json()
    if (data.success) {
      setHandmatig(prev => prev.map(w => String(w.matchId) === String(wijzigenId) ? data.wedstrijd : w))
      setWijzigenId(null)
      setMelding({ type: 'ok', tekst: 'Wedstrijd gewijzigd!' })
    } else {
      setMelding({ type: 'fout', tekst: data.error })
    }
  }

  async function handleVerwijderen(matchId) {
    if (!confirm('Wedstrijd verwijderen?')) return
    const r = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verwijderen', matchId })
    })
    const data = await r.json()
    if (data.success) {
      setHandmatig(prev => prev.filter(w => String(w.matchId) !== String(matchId)))
      setMelding({ type: 'ok', tekst: 'Wedstrijd verwijderd' })
    }
  }

  const gesorteerdHandmatig = [...handmatig].sort((a, b) => new Date(a.datumISO) - new Date(b.datumISO))

  return (
    <>
      <div className={styles.sectie}>
        <label className={styles.label}>Handmatig toegevoegde wedstrijden</label>
        {handmatig.length === 0 && <p className={styles.leegTekst}>Geen handmatige wedstrijden</p>}
        {gesorteerdHandmatig.map(w => (
          <div key={w.matchId} className={styles.beheerRij}>
            {wijzigenId === w.matchId ? (
              <div className={styles.wijzigenForm}>
                <select className={styles.select} value={wijzigenData.competitie}
                  onChange={e => setWijzigenData(p => ({...p, competitie: e.target.value}))}>
                  {COMPETITIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input className={styles.inputDatum} value={wijzigenData.datumISO}
                  type="datetime-local"
                  onChange={e => setWijzigenData(p => ({...p, datumISO: e.target.value}))} />
                <div className={styles.teamRij}>
                  <div className={styles.teamBlok}>
                    <input className={styles.input} value={wijzigenData.thuis}
                      placeholder="PSV" maxLength={3}
                      onChange={e => { const v = e.target.value.toUpperCase(); setWijzigenData(p => ({...p, thuis: v, thuisNaam: TEAM_NAMEN[v] || p.thuisNaam})) }} />
                    <input className={styles.input} value={wijzigenData.thuisNaam}
                      placeholder="PSV Eindhoven"
                      onChange={e => setWijzigenData(p => ({...p, thuisNaam: e.target.value}))} />
                  </div>
                  <div className={styles.teamBlok}>
                    <input className={styles.input} value={wijzigenData.uit}
                      placeholder="AJX" maxLength={3}
                      onChange={e => { const v = e.target.value.toUpperCase(); setWijzigenData(p => ({...p, uit: v, uitNaam: TEAM_NAMEN[v] || p.uitNaam})) }} />
                    <input className={styles.input} value={wijzigenData.uitNaam}
                      placeholder="Ajax"
                      onChange={e => setWijzigenData(p => ({...p, uitNaam: e.target.value}))} />
                  </div>
                </div>
                <div className={styles.beheerBtns}>
                  <button className={styles.btnKlein} onClick={handleWijzigen}>Opslaan</button>
                  <button className={styles.btnKleinGrijs} onClick={() => setWijzigenId(null)}>Annuleren</button>
                </div>
              </div>
            ) : (
              <>
                <div className={styles.beheerInfo}>
                  <span className={styles.compTag}>{w.competitie}</span>
                  <span className={styles.beheerNaam}>{w.datum} — {w.thuis} vs {w.uit}</span>
                  {w.uitslag && <span className={styles.beheerUitslag}>{w.uitslag.home}-{w.uitslag.away}</span>}
                </div>
                <div className={styles.beheerBtns}>
                  <button className={styles.btnKlein} onClick={() => startWijzigen(w)}>✏️</button>
                  <button className={styles.btnKleinRood} onClick={() => handleVerwijderen(w.matchId)}>🗑️</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <AdminVoorspellingen alleWedstrijden={alleWedstrijden} setMelding={setMelding} />
    </>
  )
}
