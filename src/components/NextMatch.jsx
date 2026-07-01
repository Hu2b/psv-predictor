import { useState, useEffect } from 'react'
import H2H from './H2H.jsx'
import PredictionForm from './PredictionForm.jsx'
import LiveScore from './LiveScore.jsx'
import styles from './NextMatch.module.css'

const COMP_LABELS = {
 JCS: 'Johan Cruijff Schaal',
 ERE: 'Eredivisie',
 KNVB: 'KNVB Beker',
 CL: 'Champions League',
 UL: 'UEFA League',
}

export default function NextMatch({ fixture, fixtures, speler }) {
 const [gekozenId, setGekozenId] = useState(null)
 const [handmatig, setHandmatig] = useState([])

 useEffect(() => {
   async function laad() {
     try {
       const r = await fetch('/api/admin?action=wedstrijden')
       const data = await r.json()
       setHandmatig(data.wedstrijden || [])
     } catch (_) {}
   }
   laad()
 }, [])

 const alleWedstrijden = [...fixtures, ...handmatig]
   .sort((a, b) => new Date(a.datumISO) - new Date(b.datumISO))

 if (alleWedstrijden.length === 0) {
   return <div className={styles.leeg}><p>Geen PSV wedstrijden gevonden.</p></div>
 }

 const standaard = alleWedstrijden.find(f => !['FT','AET','PEN'].includes(f.status))
   || alleWedstrijden[alleWedstrijden.length - 1]

 const getoond = gekozenId !== null
   ? alleWedstrijden.find(f => String(f.matchId) === String(gekozenId)) || standaard
   : standaard

 const isAfgelopen = ['FT','AET','PEN'].includes(getoond.status)
 const isLive = ['1H','HT','2H','ET','BT','LIVE'].includes(getoond.status)

 return (
   <div className={styles.wrapper}>
     <div className={styles.selectorWrap}>
       <label className={styles.selectorLabel}>Wedstrijd</label>
       <select
         className={styles.selector}
         value={String(getoond.matchId)}
         onChange={e => {
           const val = e.target.value
           const match = alleWedstrijden.find(f => String(f.matchId) === String(val))
           setGekozenId(match ? match.matchId : null)
         }}
       >
         {alleWedstrijden.map(f => (
           <option key={f.matchId} value={String(f.matchId)}>
             #{f.volgnummer || '—'} {f.datum} — {f.thuis} vs {f.uit} ({f.competitie})
             {['FT','AET','PEN'].includes(f.status) ? ' ✓' : ''}
           </option>
         ))}
       </select>
     </div>

     <div className={styles.card}>
       <div className={styles.compRow}>
         <span className={styles.compBadge}>{COMP_LABELS[getoond.competitie] || getoond.competitie}</span>
         <span className={styles.volgnr}>#{getoond.volgnummer || '—'}</span>
       </div>
       <div className={styles.datum}>{getoond.datum}</div>
       <div className={styles.teams}>
         <div className={styles.team}>
           {getoond.thuisLogo && <img src={getoond.thuisLogo} alt="" className={styles.logo} />}
           <span className={styles.teamCode}>{getoond.thuis}</span>
           <span className={styles.teamNaam}>{getoond.thuisNaam}</span>
         </div>
         <div className={styles.vsBlok}>
           {isAfgelopen ? (
             <div className={styles.eindstand}>
               <span className={styles.eindstandScore}>{getoond.uitslag?.home} – {getoond.uitslag?.away}</span>
               <span className={styles.eindstandLabel}>Eindstand</span>
             </div>
           ) : isLive ? (
             <div className={styles.liveBlok}>
               <span className={styles.liveDot} />
               <span className={styles.liveLabel}>LIVE</span>
             </div>
           ) : (
             <span className={styles.vs}>VS</span>
           )}
         </div>
         <div className={`${styles.team} ${styles.teamRight}`}>
           {getoond.uitLogo && <img src={getoond.uitLogo} alt="" className={styles.logo} />}
           <span className={styles.teamCode}>{getoond.uit}</span>
           <span className={styles.teamNaam}>{getoond.uitNaam}</span>
         </div>
       </div>
     </div>

     {isLive && <LiveScore fixture={getoond} />}
     <H2H thuisId={getoond.thuisId} uitId={getoond.uitId} />
     <PredictionForm fixture={getoond} speler={speler} />
   </div>
 )
}
