// shared/teams.js — enige bron van waarheid voor teamnamen, afkortingen en logo's
export const TEAMS = {
  PSV: { naam: 'PSV Eindhoven', aliases: ['PSV Eindhoven','PSV'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/PSV_Eindhoven.svg' },
  AJX: { naam: 'Ajax', aliases: ['Ajax','AFC Ajax'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Ajax_Amsterdam.svg' },
  FEY: { naam: 'Feyenoord', aliases: ['Feyenoord','Feyenoord Rotterdam'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Feyenoord_logo.svg' },
  'AZ ': { naam: 'AZ Alkmaar', aliases: ['AZ','AZ Alkmaar'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/AZ_Alkmaar_logo.svg' },
  UTR: { naam: 'FC Utrecht', aliases: ['FC Utrecht'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/FC_Utrecht.svg' },
  TWE: { naam: 'FC Twente', aliases: ['FC Twente','FC Twente Enschede'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/FC_Twente_logo.svg' },
  NEC: { naam: 'NEC Nijmegen', aliases: ['NEC','NEC Nijmegen'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/NEC_Nijmegen_logo.svg' },
  HEE: { naam: 'sc Heerenveen', aliases: ['sc Heerenveen'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Sc_Heerenveen.svg' },
  GRO: { naam: 'FC Groningen', aliases: ['FC Groningen'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/FC_Groningen.svg' },
  ALM: { naam: 'Almere City FC', aliases: ['Almere City FC'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Almere_City_FC_logo.svg' },
  SPA: { naam: 'Sparta Rotterdam', aliases: ['Sparta Rotterdam'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Sparta_Rotterdam_logo.svg' },
  GAE: { naam: 'Go Ahead Eagles', aliases: ['Go Ahead Eagles'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Go_Ahead_Eagles_logo.svg' },
  RKC: { naam: 'RKC Waalwijk', aliases: ['RKC Waalwijk'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/RKC_Waalwijk.svg' },
  PEC: { naam: 'PEC Zwolle', aliases: ['PEC Zwolle'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/PEC_Zwolle_logo.svg' },
  FOR: { naam: 'Fortuna Sittard', aliases: ['Fortuna Sittard'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Fortuna_Sittard_logo.svg' },
  WIL: { naam: 'Willem II', aliases: ['Willem II'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Willem_II_(football_club)_logo.svg' },
  NAC: { naam: 'NAC Breda', aliases: ['NAC Breda'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/NAC_Breda.svg' },
  HER: { naam: 'Heracles Almelo', aliases: ['Heracles Almelo'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Heracles_Almelo_logo.svg' },
  EXC: { naam: 'Excelsior', aliases: ['Excelsior','SBV Excelsior'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/SBV_Excelsior_logo.svg' },
  CAM: { naam: 'SC Cambuur', aliases: ['SC Cambuur'], logo: null },
  VOL: { naam: 'FC Volendam', aliases: ['FC Volendam'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/FC_Volendam_logo.svg' },
  TEL: { naam: 'Telstar 1963', aliases: ['Telstar 1963'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/SC_Telstar_logo.svg' },
  ADO: { naam: 'ADO Den Haag', aliases: ['ADO Den Haag'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/ADO_Den_Haag_logo.svg' },
  BAR: { naam: 'FC Barcelona', aliases: ['FC Barcelona'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/FC_Barcelona_(crest).svg' },
  REA: { naam: 'Real Madrid', aliases: ['Real Madrid'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Real_Madrid_CF.svg' },
  MCI: { naam: 'Manchester City', aliases: ['Manchester City'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Manchester_City_FC_badge.svg' },
  LIV: { naam: 'Liverpool FC', aliases: ['Liverpool FC'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Liverpool_FC.svg' },
  BAY: { naam: 'Bayern München', aliases: ['Bayern München'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/FC_Bayern_München_logo_(2017).svg' },
  BOR: { naam: 'Borussia Dortmund', aliases: ['Borussia Dortmund'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Borussia_Dortmund_logo.svg' },
}

// naam (zoals football-data.org die aanlevert) -> code, met fallback voor onbekende teams
export function zoekAfkorting(naam) {
  for (const [code, t] of Object.entries(TEAMS)) {
    if (t.aliases.includes(naam)) return code
  }
  return naam.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase()
}

// code -> volledige naam, voor autocomplete bij handmatig toevoegen
export function zoekNaam(code) {
  return TEAMS[code]?.naam || code
}

// code -> logo-URL, of null als onbekend (frontend valt dan terug op alleen tekst)
export function zoekLogo(code) {
  return TEAMS[code]?.logo || null
}

// Voor gebruik in de "Toevoegen"-formulieren (code -> naam als plat object)
export function teamNamenObject() {
  return Object.fromEntries(Object.entries(TEAMS).map(([code, t]) => [code, t.naam]))
}
