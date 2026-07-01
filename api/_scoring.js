export function berekenPunten(pred, uitslag) {
  if (!pred || !uitslag) return 0

  const predToto = Math.sign(pred.home - pred.away)
  const uitsToto = Math.sign(uitslag.home - uitslag.away)
  const totoPunten = predToto === uitsToto ? 5 : 0

  let scorePunten = 0
  if (pred.home === uitslag.home && pred.away === uitslag.away) {
    scorePunten = 5
  } else if (pred.home === uitslag.home || pred.away === uitslag.away) {
    scorePunten = 2
  }

  return totoPunten + scorePunten
}

export function totoLabel(pred) {
  if (!pred) return null
  const diff = pred.home - pred.away
  if (diff > 0) return '1'
  if (diff < 0) return '2'
  return 'X'
}
