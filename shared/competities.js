// Enige bron van waarheid voor volledige competitienamen. Wordt gebruikt op
// het Wedstrijd-scherm, het Totaal-scherm en in de gedeelde afbeelding, zodat
// een code als "ERE" overal consistent wordt getoond als "Eredivisie" i.p.v.
// dat elk scherm zijn eigen (mogelijk uit de pas lopende) kopie bijhoudt.
export const COMP_LABELS = {
  JCS: 'Johan Cruijff Schaal',
  ERE: 'Eredivisie',
  KNVB: 'KNVB Beker',
  CL: 'Champions League',
  UL: 'UEFA League',
  VRI: 'Vriendschappelijk',
  LICHT: 'Lichtstadderby',
}

// code -> volledige naam, met de code zelf als fallback voor iets onbekends
export function competitieNaam(code) {
  return COMP_LABELS[code] || code
}
