// Enige bron van waarheid voor teamnamen, afkortingen en logo's.
// Wordt zowel door api/-functies als src/-componenten gebruikt.
export const TEAMS = {
  // Eredivisie
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

  // Champions League 2026/27 — 29 bevestigde deelnemers (stand 24 mei 2026)
  BAR: { naam: 'FC Barcelona', aliases: ['FC Barcelona'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/FC_Barcelona_(crest).svg' },
  REA: { naam: 'Real Madrid', aliases: ['Real Madrid'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Real_Madrid_CF.svg' },
  MCI: { naam: 'Manchester City', aliases: ['Manchester City'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Manchester_City_FC_badge.svg' },
  LIV: { naam: 'Liverpool FC', aliases: ['Liverpool FC'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Liverpool_FC.svg' },
  BAY: { naam: 'Bayern München', aliases: ['Bayern München'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/FC_Bayern_München_logo_(2017).svg' },
  BOR: { naam: 'Borussia Dortmund', aliases: ['Borussia Dortmund'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Borussia_Dortmund_logo.svg' },
  PSG: { naam: 'Paris Saint-Germain', aliases: ['Paris Saint-Germain'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Paris_Saint-Germain_F.C..svg' },
  AVL: { naam: 'Aston Villa', aliases: ['Aston Villa'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Aston_Villa_FC_crest_(2016).svg' },
  ARS: { naam: 'Arsenal', aliases: ['Arsenal'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Arsenal_FC.svg' },
  MUN: { naam: 'Manchester United', aliases: ['Manchester United'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Manchester_United_FC_crest.svg' },
  INT: { naam: 'Inter Milan', aliases: ['Inter Milan'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/FC_Internazionale_Milano_2021.svg' },
  NAP: { naam: 'Napoli', aliases: ['Napoli'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/SSC_Napoli_2007.svg' },
  ROM: { naam: 'Roma', aliases: ['Roma'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/AS_Roma_crest.svg' },
  COM: { naam: 'Como', aliases: ['Como'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Como_1907_logo.svg' },
  VIL: { naam: 'Villarreal', aliases: ['Villarreal'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Villarreal_CF_logo.svg' },
  ATM: { naam: 'Atlético Madrid', aliases: ['Atlético Madrid','Atletico Madrid'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Atletico_Madrid_2017_logo.svg' },
  BET: { naam: 'Real Betis', aliases: ['Real Betis'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Real_betis_logo.svg' },
  RBL: { naam: 'RB Leipzig', aliases: ['RB Leipzig'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/RB_Leipzig_2014_logo.svg' },
  VFB: { naam: 'VfB Stuttgart', aliases: ['VfB Stuttgart'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/VfB_Stuttgart_1893_Logo.svg' },
  LEN: { naam: 'Lens', aliases: ['Lens','RC Lens'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Racing_Club_de_Lens_logo.svg' },
  LIL: { naam: 'Lille', aliases: ['Lille','Lille OSC'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/LOSC_Lille_2018_(logo).svg' },
  POR: { naam: 'Porto', aliases: ['Porto','FC Porto'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/FC_Porto.svg' },
  SCP: { naam: 'Sporting CP', aliases: ['Sporting CP'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Sporting_Clube_de_Portugal_(Logo).svg' },
  BRU: { naam: 'Club Brugge', aliases: ['Club Brugge'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Club_Brugge_KV_logo.svg' },
  SLA: { naam: 'Slavia Prague', aliases: ['Slavia Prague'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/SK_Slavia_Praha_logo.svg' },
  GAL: { naam: 'Galatasaray', aliases: ['Galatasaray'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Galatasaray_Sports_Club_Logo.svg' },
  SHA: { naam: 'Shakhtar Donetsk', aliases: ['Shakhtar Donetsk'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/FC_Shakhtar_Donetsk_logo.svg' },

  // Champions League 2026/27 play-off-kandidaten — NOG NIET bevestigd (stand 24 mei 2026)
  CEL: { naam: 'Celtic', aliases: ['Celtic'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Celtic_FC.svg' },
  AEK: { naam: 'AEK Athens', aliases: ['AEK Athens'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/AEK_Athens_FC_logo.svg' },
  LAS: { naam: 'LASK', aliases: ['LASK'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/LASK_Linz_logo.svg' },
  VIK: { naam: 'Viking', aliases: ['Viking'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Viking_FK_logo.svg' },
  LYO: { naam: 'Lyon', aliases: ['Lyon'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Olympique_Lyonnais_logo.svg' },
  USG: { naam: 'Union Saint-Gilloise', aliases: ['Union Saint-Gilloise'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Royale_Union_Saint-Gilloise_logo.svg' },
  SPR: { naam: 'Sparta Prague', aliases: ['Sparta Prague'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/AC_Sparta_Praha_logo.svg' },
  BOD: { naam: 'Bodø/Glimt', aliases: ['Bodø/Glimt'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/FK_Bod%C3%B8Glimt_logo.svg' },
  OLY: { naam: 'Olympiacos', aliases: ['Olympiacos'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Olympiacos_FC_LOGO.svg' },
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

// code -> logo-URL (statische fallback), of null als onbekend
export function zoekLogo(code) {
  return TEAMS[code]?.logo || null
}

// Voor gebruik in de "Toevoegen"-formulieren (code -> naam als plat object)
export function teamNamenObject() {
  return Object.fromEntries(Object.entries(TEAMS).map(([code, t]) => [code, t.naam]))
}
