// Handmatig bijgehouden archief van historische PSV-ontmoetingen.
//
// Dit is een VANGNET: het wordt alleen getoond als football-data.org géén
// recente onderlinge ontmoetingen kent voor een wedstrijd (hun database gaat
// niet ver genoeg terug voor bijv. de Europacup-duels uit de jaren 80).
// Zodra de teams elkaar (weer) treffen in een competitie die de API dekt,
// verdwijnt dit archief vanzelf achter de echte, actuele data.
//
// Bijhouden:
// - De sleutel is: beide teamcodes alfabetisch gesorteerd, met | ertussen
//   (bijv. 'PSV|RMA', 'POR|PSV'). Gebruik de codes uit shared/teams.js.
// - Zet per sleutel de nieuwste ontmoeting bovenaan; er worden er maximaal 3
//   getoond.
// - `competitie` is een vrij kort label (bijv. 'EC1' voor Europacup I).
const ARCHIEF = {
  'PSV|RMA': [
    { datum: '20 apr 1988', thuis: 'PSV', uit: 'Real Madrid', uitslag: '0-0', competitie: 'EC1' },
    { datum: '6 apr 1988', thuis: 'Real Madrid', uit: 'PSV', uitslag: '1-1', competitie: 'EC1' },
  ],
  // Voorbeeld om zelf aan te vullen (verwijder de // en vul in):
  // 'POR|PSV': [
  //   { datum: '…', thuis: '…', uit: '…', uitslag: '…', competitie: '…' },
  // ],
}

// Geeft de historische ontmoetingen voor twee teamcodes (volgorde maakt niet
// uit), of een lege lijst als er niets in het archief staat.
export function zoekHistorischeOntmoetingen(codeA, codeB) {
  if (!codeA || !codeB) return []
  const sleutel = [codeA, codeB].sort().join('|')
  return ARCHIEF[sleutel] || []
}
