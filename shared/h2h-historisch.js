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
//   getoond (de rest blijft als naslag gewoon in dit bestand staan).
// - `competitie` is een vrij kort label: EC1 = Europacup I, EC2 = Europacup II,
//   EC3 = UEFA Cup/Europacup III, CL = Champions League, OEF = oefenwedstrijd.
const ARCHIEF = {
  'POR|PSV': [
    { datum: '21 jul 2016', thuis: 'PSV', uit: 'Porto', uitslag: '3-0', competitie: 'OEF' },
    { datum: '7 apr 1993', thuis: 'PSV', uit: 'Porto', uitslag: '0-1', competitie: 'CL' },
    { datum: '25 nov 1992', thuis: 'Porto', uit: 'PSV', uitslag: '2-2', competitie: 'CL' },
    { datum: '9 nov 1988', thuis: 'Porto', uit: 'PSV', uitslag: '2-0', competitie: 'EC1' },
    { datum: '26 okt 1988', thuis: 'PSV', uit: 'Porto', uitslag: '5-0', competitie: 'EC1' },
  ],
  'CLU|PSV': [
    { datum: '13 jul 2024', thuis: 'PSV', uit: 'Club Brugge', uitslag: '1-1', competitie: 'OEF' },
    { datum: '9 jan 2020', thuis: 'PSV', uit: 'Club Brugge', uitslag: '1-2', competitie: 'OEF' },
    { datum: '11 jan 2019', thuis: 'PSV', uit: 'Club Brugge', uitslag: '2-1', competitie: 'OEF' },
    { datum: '2 sep 2010', thuis: 'PSV', uit: 'Club Brugge', uitslag: '2-0', competitie: 'OEF' },
    { datum: '5 aug 2000', thuis: 'Club Brugge', uit: 'PSV', uitslag: '4-0', competitie: 'OEF' },
    { datum: '6 jan 1993', thuis: 'Club Brugge', uit: 'PSV', uitslag: '1-1', competitie: 'OEF' },
    { datum: '19 aug 1990', thuis: 'PSV', uit: 'Club Brugge', uitslag: '0-2', competitie: 'OEF' },
    { datum: '5 aug 1989', thuis: 'Club Brugge', uit: 'PSV', uitslag: '1-1', competitie: 'OEF' },
    { datum: '17 aug 1984', thuis: 'PSV', uit: 'Club Brugge', uitslag: '8-0', competitie: 'OEF' },
    { datum: '14 aug 1983', thuis: 'PSV', uit: 'Club Brugge', uitslag: '0-5', competitie: 'OEF' },
  ],
  'PSV|RMA': [
    { datum: '5 aug 2007', thuis: 'Real Madrid', uit: 'PSV', uitslag: '1-2', competitie: 'OEF' },
    { datum: '21 mei 1996', thuis: 'Real Madrid', uit: 'PSV', uitslag: '2-2', competitie: 'OEF' },
    { datum: '15 dec 1994', thuis: 'Real Madrid', uit: 'PSV', uitslag: '3-0', competitie: 'OEF' },
    { datum: '27 aug 1992', thuis: 'Real Madrid', uit: 'PSV', uitslag: '3-2', competitie: 'OEF' },
    { datum: '13 aug 1989', thuis: 'Real Madrid', uit: 'PSV', uitslag: '4-2', competitie: 'OEF' },
    { datum: '15 mrt 1989', thuis: 'Real Madrid', uit: 'PSV', uitslag: '2-1', competitie: 'EC1' },
    { datum: '1 mrt 1989', thuis: 'PSV', uit: 'Real Madrid', uitslag: '1-1', competitie: 'EC1' },
    { datum: '20 apr 1988', thuis: 'PSV', uit: 'Real Madrid', uitslag: '0-0', competitie: 'EC1' },
    { datum: '6 apr 1988', thuis: 'Real Madrid', uit: 'PSV', uitslag: '1-1', competitie: 'EC1' },
    { datum: '3 nov 1971', thuis: 'PSV', uit: 'Real Madrid', uitslag: '2-0', competitie: 'EC3' },
    { datum: '20 okt 1971', thuis: 'Real Madrid', uit: 'PSV', uitslag: '3-1', competitie: 'EC3' },
    { datum: '28 apr 1971', thuis: 'Real Madrid', uit: 'PSV', uitslag: '2-1', competitie: 'EC2' },
    { datum: '14 apr 1971', thuis: 'PSV', uit: 'Real Madrid', uitslag: '0-0', competitie: 'EC2' },
  ],
}

// Geeft de historische ontmoetingen voor twee teamcodes (volgorde maakt niet
// uit), of een lege lijst als er niets in het archief staat.
export function zoekHistorischeOntmoetingen(codeA, codeB) {
  if (!codeA || !codeB) return []
  const sleutel = [codeA, codeB].sort().join('|')
  return ARCHIEF[sleutel] || []
}
