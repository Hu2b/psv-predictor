// Rekent het klassementsverloop uit: per speler hoeveel punten hij na elke
// gespeelde wedstrijd had staan. De grafiek in de app tekent dat alleen nog.
//
// De x-as loopt van wedstrijd 1 tot en met de laatste wedstrijd die op de
// agenda staat. Dat laatste nummer groeit tijdens het seizoen mee — er worden
// bekerrondes en Europese wedstrijden bijgeplaatst zodra ze bekend zijn — dus
// het is nadrukkelijk geen vast getal.

// Het volgnummer van een wedstrijd, met de datum als terugval voor oude
// resultaten die nog zonder volgnummer zijn opgeslagen.
function nummer(wedstrijd, index) {
  const nr = Number(wedstrijd?.volgnummer)
  return Number.isFinite(nr) && nr > 0 ? nr : index + 1
}

// Hoeveel wedstrijden staan er in totaal op de agenda?
export function totaalWedstrijden(fixtures, resultaten) {
  const uitAgenda = (fixtures || []).map((f, i) => nummer(f, i))
  const uitResultaten = (resultaten || []).map((r, i) => nummer(r, i))
  const alle = [...uitAgenda, ...uitResultaten]
  return alle.length > 0 ? Math.max(...alle) : 0
}

// Per speler een reeks punten over de tijd. Elke reeks begint op wedstrijd 0
// met nul punten, zodat de lijn op de as begint en niet ergens in de lucht.
//
// Een speler die later is toegevoegd staat niet in de totalen van eerdere
// wedstrijden; die houdt zijn vorige stand aan (bij het begin dus nul). Zo
// loopt zijn lijn vlak tot zijn eerste wedstrijd in plaats van weg te vallen.
export function maakTrend(resultaten, fixtures, naamPerSpeler = {}) {
  const gespeeld = [...(resultaten || [])]
    .map((r, i) => ({ ...r, nr: nummer(r, i) }))
    .sort((a, b) => a.nr - b.nr)

  const spelerIds = [...new Set(gespeeld.flatMap(r => Object.keys(r.totalen || {})))]
    .sort((a, b) => (naamPerSpeler[a] || a).localeCompare(naamPerSpeler[b] || b))

  const reeksen = spelerIds.map(playerId => {
    let laatste = 0
    const punten = [{ nr: 0, totaal: 0 }]
    for (const r of gespeeld) {
      const waarde = r.totalen?.[playerId]
      if (Number.isFinite(waarde)) laatste = waarde
      punten.push({ nr: r.nr, totaal: laatste })
    }
    return { playerId, naam: naamPerSpeler[playerId] || '???', punten, eind: laatste }
  })

  const laatstGespeeld = gespeeld.length > 0 ? gespeeld[gespeeld.length - 1].nr : 0
  const maxPunten = Math.max(0, ...reeksen.map(r => r.eind))

  return {
    reeksen,
    gespeeld: gespeeld.map(r => ({ nr: r.nr, datum: r.datum, thuis: r.thuis, uit: r.uit, uitslag: r.uitslag })),
    laatstGespeeld,
    totaal: Math.max(laatstGespeeld, totaalWedstrijden(fixtures, resultaten)),
    maxPunten,
  }
}

// Nette ronde stappen voor de y-as: 0, 10, 20, … of grover als er veel punten
// staan. Vijf lijnen is genoeg; meer maakt een grafiek van dit formaat alleen
// maar druk.
export function asStappen(maxPunten, aantal = 4) {
  const ruw = Math.max(1, maxPunten) / aantal
  const grootte = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500].find(s => s >= ruw) || 1000
  const top = Math.ceil(Math.max(1, maxPunten) / grootte) * grootte
  const stappen = []
  for (let w = 0; w <= top; w += grootte) stappen.push(w)
  return { top, stappen }
}
