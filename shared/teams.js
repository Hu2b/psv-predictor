// Enige bron van waarheid voor teamnamen, afkortingen en logo's.
// Wordt zowel door api/-functies als src/-componenten gebruikt.
//
// Afkortingen zijn LEIDEND op basis van de door de gebruiker aangeleverde
// officiële lijst (Eredivisie/Eerste divisie-clubs + de definitieve
// Champions League league phase 2025/26, 34 clubs). Waar geen logo-URL
// bekend/geverifieerd is, staat expliciet `logo: null` — dat is geen bug:
// zodra er een keer een automatische (football-data.org) wedstrijd met dat
// team gesynchroniseerd wordt, slaat het systeem het echte clublogo zelf op
// (zie api/_logo-lookup.js) en wordt deze statische placeholder niet meer
// gebruikt. Alleen bij UITSLUITEND handmatig toegevoegde wedstrijden met
// zo'n team blijft het logo tot die tijd leeg (transparant vlak, geen kapot
// plaatje).
export const TEAMS = {
  // Eredivisie
  PSV: { naam: 'PSV Eindhoven', aliases: ['PSV Eindhoven','PSV'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/PSV_Eindhoven.svg' },
  AJA: { naam: 'Ajax', aliases: ['Ajax','AFC Ajax'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Ajax_Amsterdam.svg' },
  FEY: { naam: 'Feyenoord', aliases: ['Feyenoord','Feyenoord Rotterdam'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Feyenoord_logo.svg' },
  AZ: { naam: 'AZ', aliases: ['AZ','AZ Alkmaar'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/AZ_Alkmaar.svg' },
  UTR: { naam: 'FC Utrecht', aliases: ['FC Utrecht'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/FC_Utrecht.svg' },
  TWE: { naam: 'FC Twente', aliases: ['FC Twente','FC Twente Enschede',"FC Twente '65"], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/FC_Twente_logo.svg' },
  NEC: { naam: 'NEC Nijmegen', aliases: ['NEC','NEC Nijmegen'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/NEC_Nijmegen_logo.svg' },
  HEE: { naam: 'sc Heerenveen', aliases: ['sc Heerenveen'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Sc_Heerenveen.svg' },
  GRO: { naam: 'FC Groningen', aliases: ['FC Groningen'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/FC_Groningen.svg' },
  GAE: { naam: 'Go Ahead Eagles', aliases: ['Go Ahead Eagles'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Go_Ahead_Eagles_logo.svg' },
  SPA: { naam: 'Sparta Rotterdam', aliases: ['Sparta Rotterdam'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Sparta_Rotterdam_logo.svg' },
  PEC: { naam: 'PEC Zwolle', aliases: ['PEC Zwolle'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/PEC_Zwolle_logo.svg' },
  FOR: { naam: 'Fortuna Sittard', aliases: ['Fortuna Sittard'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Fortuna_Sittard_logo.svg' },
  NAC: { naam: 'NAC Breda', aliases: ['NAC Breda'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/NAC_Breda.svg' },
  HER: { naam: 'Heracles Almelo', aliases: ['Heracles Almelo'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Heracles_Almelo_logo.svg' },
  EXC: { naam: 'Excelsior', aliases: ['Excelsior','SBV Excelsior'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/SBV_Excelsior_logo.svg' },
  VOL: { naam: 'FC Volendam', aliases: ['FC Volendam'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/FC_Volendam_logo.svg' },
  TEL: { naam: 'Telstar', aliases: ['Telstar','Telstar 1963'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/SC_Telstar_logo.svg' },

  // Keuken Kampioen Divisie (Eerste divisie)
  ADO: { naam: 'ADO Den Haag', aliases: ['ADO Den Haag'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/ADO_Den_Haag_logo.svg' },
  ALM: { naam: 'Almere City', aliases: ['Almere City FC','Almere City'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Almere_City_FC_logo.svg' },
  CAM: { naam: 'SC Cambuur', aliases: ['SC Cambuur','SC Cambuur-Leeuwarden'], logo: null },
  DEG: { naam: 'De Graafschap', aliases: ['De Graafschap'], logo: null },
  DBO: { naam: 'FC Den Bosch', aliases: ['FC Den Bosch'], logo: null },
  DOR: { naam: 'FC Dordrecht', aliases: ['FC Dordrecht'], logo: null },
  EIN: { naam: 'FC Eindhoven', aliases: ['FC Eindhoven'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/FCEindhoven-logo-2022-officieel-RGB.png' },
  EMM: { naam: 'FC Emmen', aliases: ['FC Emmen'], logo: null },
  HEL: { naam: 'Helmond Sport', aliases: ['Helmond Sport'], logo: null },
  JAJ: { naam: 'Jong Ajax', aliases: ['Jong Ajax'], logo: null },
  JAZ: { naam: 'Jong AZ', aliases: ['Jong AZ'], logo: null },
  JUT: { naam: 'Jong FC Utrecht', aliases: ['Jong FC Utrecht'], logo: null },
  JPS: { naam: 'Jong PSV', aliases: ['Jong PSV'], logo: null },
  MVV: { naam: 'MVV Maastricht', aliases: ['MVV Maastricht','MVV'], logo: null },
  RKC: { naam: 'RKC Waalwijk', aliases: ['RKC Waalwijk'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/RKC_Waalwijk.svg' },
  RJC: { naam: 'Roda JC', aliases: ['Roda JC','Roda JC Kerkrade'], logo: null },
  TOP: { naam: 'TOP Oss', aliases: ['TOP Oss'], logo: null },
  VIT: { naam: 'Vitesse', aliases: ['Vitesse'], logo: null },
  VVV: { naam: 'VVV-Venlo', aliases: ['VVV-Venlo','VVV Venlo'], logo: null },
  WIL: { naam: 'Willem II', aliases: ['Willem II'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Willem_II_(football_club)_logo.svg' },

  // Champions League — definitieve league phase 2025/26 (34 clubs)
  ARS: { naam: 'Arsenal', aliases: ['Arsenal','Arsenal FC'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Arsenal_FC.svg' },
  ATA: { naam: 'Atalanta', aliases: ['Atalanta','Atalanta BC'], logo: null },
  ATH: { naam: 'Athletic Club', aliases: ['Athletic Club','Athletic Bilbao'], logo: null },
  ATM: { naam: 'Atlético Madrid', aliases: ['Atlético Madrid','Atletico Madrid'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Atletico_Madrid_2017_logo.svg' },
  BAY: { naam: 'Bayern München', aliases: ['Bayern München','FC Bayern München'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/FC_Bayern_München_logo_(2017).svg' },
  LEV: { naam: 'Bayer Leverkusen', aliases: ['Bayer Leverkusen','Bayer 04 Leverkusen'], logo: null },
  BEN: { naam: 'Benfica', aliases: ['Benfica','SL Benfica'], logo: null },
  BOD: { naam: 'Bodø/Glimt', aliases: ['Bodø/Glimt'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/FK_Bod%C3%B8Glimt_logo.svg' },
  BVB: { naam: 'Borussia Dortmund', aliases: ['Borussia Dortmund'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Borussia_Dortmund_logo.svg' },
  BRU: { naam: 'Club Brugge', aliases: ['Club Brugge'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Club_Brugge_KV_logo.svg' },
  BAR: { naam: 'FC Barcelona', aliases: ['FC Barcelona'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/FC_Barcelona_(crest).svg' },
  CHE: { naam: 'Chelsea', aliases: ['Chelsea','Chelsea FC'], logo: null },
  COP: { naam: 'FC Kopenhagen', aliases: ['FC Copenhagen','FC København'], logo: null },
  FRA: { naam: 'Eintracht Frankfurt', aliases: ['Eintracht Frankfurt'], logo: null },
  GAL: { naam: 'Galatasaray', aliases: ['Galatasaray'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Galatasaray_Sports_Club_Logo.svg' },
  INT: { naam: 'Inter', aliases: ['Inter','Inter Milan','FC Internazionale Milano'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/FC_Internazionale_Milano_2021.svg' },
  JUV: { naam: 'Juventus', aliases: ['Juventus','Juventus FC'], logo: null },
  KAI: { naam: 'Kairat Almaty', aliases: ['Kairat Almaty','FC Kairat'], logo: null },
  LIV: { naam: 'Liverpool', aliases: ['Liverpool FC','Liverpool'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Liverpool_FC.svg' },
  MCI: { naam: 'Manchester City', aliases: ['Manchester City'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Manchester_City_FC_badge.svg' },
  MAR: { naam: 'Marseille', aliases: ['Marseille','Olympique de Marseille'], logo: null },
  MON: { naam: 'AS Monaco', aliases: ['AS Monaco','Monaco'], logo: null },
  NAP: { naam: 'Napoli', aliases: ['Napoli','SSC Napoli'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/SSC_Napoli_2007.svg' },
  NEW: { naam: 'Newcastle United', aliases: ['Newcastle United','Newcastle'], logo: null },
  OLY: { naam: 'Olympiacos', aliases: ['Olympiacos'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Olympiacos_FC_LOGO.svg' },
  PAF: { naam: 'Pafos FC', aliases: ['Pafos FC','Pafos'], logo: null },
  PSG: { naam: 'Paris Saint-Germain', aliases: ['Paris Saint-Germain'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Paris_Saint-Germain_F.C..svg' },
  QAR: { naam: 'Qarabağ', aliases: ['Qarabağ','Qarabag FK'], logo: null },
  RMA: { naam: 'Real Madrid', aliases: ['Real Madrid'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Real_Madrid_CF.svg' },
  SLA: { naam: 'Slavia Praag', aliases: ['Slavia Prague','Slavia Praha'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/SK_Slavia_Praha_logo.svg' },
  SCP: { naam: 'Sporting CP', aliases: ['Sporting CP'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Sporting_Clube_de_Portugal_(Logo).svg' },
  TOT: { naam: 'Tottenham Hotspur', aliases: ['Tottenham Hotspur','Tottenham'], logo: null },
  USG: { naam: 'Union Saint-Gilloise', aliases: ['Union Saint-Gilloise'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Royale_Union_Saint-Gilloise_logo.svg' },
  VIL: { naam: 'Villarreal', aliases: ['Villarreal'], logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Villarreal_CF_logo-en.svg' },
}

// Normaliseert een teamnaam voor vergelijking: hoofdletters weg, dubbele
// spaties/rand-spaties weg, en typografische quote-varianten (’ ‘ ´ `)
// gelijkgetrokken naar de gewone rechte apostrof ('). Dat laatste is nodig
// omdat football-data.org bij namen als "FC Twente '65" soms een
// typografische apostrof (Unicode ’, U+2019) gebruikt i.p.v. de gewone
// rechte ' (U+0027) — voor het oog identiek, voor een exacte
// stringvergelijking twee compleet verschillende tekens. Voorkomt dat zulke
// onzichtbare verschillen (of schrijfwijze-verschillen als "SC Heerenveen"
// i.p.v. onze "sc Heerenveen") de match laten missen en zo bij de
// 3-letter-noodgreep terechtkomen i.p.v. de juiste, bekende afkorting.
function normaliseer(naam) {
  return String(naam)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[’‘´`]/g, "'")
}

// naam (zoals football-data.org die aanlevert) -> code, met fallback voor onbekende teams
export function zoekAfkorting(naam) {
  const genormaliseerd = normaliseer(naam)
  for (const [code, t] of Object.entries(TEAMS)) {
    if (t.aliases.some(alias => normaliseer(alias) === genormaliseerd)) return code
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
