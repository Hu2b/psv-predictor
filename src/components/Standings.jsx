import { useState, useEffect, useRef } from 'react'
import { zoekLogo } from '../../shared/teams.js'
import { competitieNaam } from '../../shared/competities.js'
import styles from './Standings.module.css'

// Vult een string met spaties tot vaste lengte (rechts uitlijnen tekst).
function padRechts(str, len) {
  str = String(str)
  return str.length >= len ? str : str + ' '.repeat(len - str.length)
}
// Vult een string met spaties tot vaste lengte (links uitlijnen, voor getallen).
function padLinks(str, len) {
  str = String(str)
  return str.length >= len ? str : ' '.repeat(len - str.length) + str
}

// Bouwt per wedstrijd een uitgelijnde tabel binnen een WhatsApp-monospace-blok
// (```...```), zodat naam/voorspelling/punten/totaal altijd nette kolommen
// vormen i.p.v. op smalle telefoonschermen af te breken over meerdere regels.
function bouwSpelerTabel(r, spelerNaamMap) {
  const rijen = Object.entries(r.predicties || {}).map(([playerId, pred]) => {
    const naam = spelerNaamMap[playerId] || '???'
    const punten = r.punten?.[playerId] ?? 0
    const totaal = r.totalen?.[playerId] ?? '—'
    const vrsp = pred ? `${pred.home}-${pred.away}` : '-'
    return { naam, vrsp, punt: `+${punten}`, totaal: String(totaal) }
  })
  if (rijen.length === 0) return null

  const naamW = Math.max(6, ...rijen.map(x => x.naam.length))
  const vrspW = Math.max(4, ...rijen.map(x => x.vrsp.length))
  const puntW = Math.max(2, ...rijen.map(x => x.punt.length))
  const totW  = Math.max(3, ...rijen.map(x => x.totaal.length))

  const regels = []
  regels.push(`${padRechts('Speler', naamW)} ${padRechts('Vrsp', vrspW)} ${padLinks('Pt', puntW)} ${padLinks('Tot', totW)}`)
  for (const x of rijen) {
    regels.push(`${padRechts(x.naam, naamW)} ${padRechts(x.vrsp, vrspW)} ${padLinks(x.punt, puntW)} ${padLinks(x.totaal, totW)}`)
  }
  return regels.join('\n')
}

function bouwWhatsAppTekst(klassement, results, spelerNaamMap) {
  const regels = []
  regels.push('🏆 *PSV Poule — Klassement*')
  regels.push('')
  klassement.forEach((s, i) => {
    regels.push(`${i + 1}. ${s.naam}: *${s.punten}* punten`)
  })
  regels.push('')
  regels.push('_Alle wedstrijden:_')

  const gesorteerd = [...results].sort((a, b) => new Date(b.datumISO) - new Date(a.datumISO))
  for (const r of gesorteerd) {
    regels.push('')
    regels.push(`#${r.volgnummer || '—'} ${r.datum} — ${competitieNaam(r.competitie)}`)
    regels.push(`${r.thuis} ${r.uitslag.home}-${r.uitslag.away} ${r.uit}`)
    const tabel = bouwSpelerTabel(r, spelerNaamMap)
    if (tabel) {
      regels.push('```')
      regels.push(tabel)
      regels.push('```')
    }
  }

  return regels.join('\n')
}

// Leest een CSS custom property (--psv-red e.d.) op zodat de afbeelding
// automatisch hetzelfde kleurenschema volgt als de rest van de app, zonder
// kleuren dubbel te hoeven onderhouden.
function cssVar(naam, fallback) {
  const waarde = getComputedStyle(document.documentElement).getPropertyValue(naam).trim()
  return waarde || fallback
}

// Handmatige afgeronde rechthoek i.p.v. ctx.roundRect(), voor bredere
// browserondersteuning (ook oudere WebViews die apps soms gebruiken om
// share-doelwitten te openen).
function tekenAfgerondeRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.arcTo(x + w, y, x + w, y + radius, radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius)
  ctx.lineTo(x + radius, y + h)
  ctx.arcTo(x, y + h, x, y + h - radius, radius)
  ctx.lineTo(x, y + radius)
  ctx.arcTo(x, y, x + radius, y, radius)
  ctx.closePath()
}

// Bouwt een PNG-afbeelding (canvas) van klassement + alle wedstrijden, in de
// stijl van de app zelf. Geeft een Blob terug die via de Web Share API
// gedeeld kan worden (navigator.share met files) — dat voorkomt het
// "past niet op 1 regel"-probleem van platte tekst volledig, want een
// afbeelding heeft geen regel-afbreekprobleem.
async function bouwDeelAfbeelding(klassement, resultaten, spelerNaamMap) {
  if (document.fonts && document.fonts.ready) {
    try { await document.fonts.ready } catch (_) {}
  }

  const kleur = {
    bg: cssVar('--psv-bg', '#111111'),
    surface: cssVar('--psv-surface', '#1E1E1E'),
    border: cssVar('--psv-border', '#2E2E2E'),
    wit: cssVar('--psv-white', '#FFFFFF'),
    rood: cssVar('--psv-red', '#E1000E'),
    // Bewust lichter dan de --psv-gray-lt van de live app: op een scherm in
    // de app is dat contrast prima, maar in een gedeelde/gecomprimeerde
    // afbeelding (WhatsApp e.d. comprimeren vaak nog eens) wordt dat te
    // schraal om goed te lezen. Leesbaarheid weegt hier zwaarder dan exact
    // dezelfde tint als de rest van de app.
    grijsLicht: '#CBD1D9',
    goud: cssVar('--gold', '#F5B800'),
    groen: cssVar('--green', '#22C55E'),
  }
  const fontDisplay = "'Barlow Condensed', Arial, sans-serif"
  const fontBody = "'Inter', -apple-system, sans-serif"

  const PAD = 28
  const W = 760
  const klassementRijHoogte = 52
  const kolX = [PAD + 16, PAD + 200, PAD + 380, W - PAD - 16]

  // --- Hoogte vooraf berekenen zodat het canvas meteen de juiste grootte heeft ---
  let hoogte = PAD
  hoogte += 46 // titel
  hoogte += 26 + 16 // onderschrift + marge
  hoogte += 30 // "KLASSEMENT"-label
  hoogte += klassement.length * klassementRijHoogte
  hoogte += 20

  if (resultaten.length > 0) {
    hoogte += 30 // "ALLE WEDSTRIJDEN"-label
    for (const r of resultaten) {
      const aantalSpelers = Object.keys(r.predicties || {}).length
      hoogte += 16 + 22 + 34 + 24 + aantalSpelers * 26 + 16 + 16
    }
  }
  hoogte += PAD
  const H = Math.ceil(hoogte)

  // 6x resolutie: bij veel wedstrijden wordt de afbeelding lang, en
  // messenger-apps zoals WhatsApp schalen 'm vaak nog eens terug voor de
  // preview/thumbnail. Let op: dit lost het "blurry worden bij inzoomen"
  // niet volledig op — dat is inherent aan elke pixel-gebaseerde afbeelding
  // (PNG incluis) zodra je verder inzoomt dan de daadwerkelijke resolutie.
  // Een hogere resolutie hier verschuift alleen het punt waarop dat gebeurt.
  const dpr = 6
  const canvas = document.createElement('canvas')
