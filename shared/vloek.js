// De PSV-vloek: wie PSV verslaat, zou daarna zelf instorten.
//
// Dit bestand rekent dat uit over een lijst wedstrijden. Het weet niets van
// waar die lijst vandaan komt — Eredivisie van football-data.org, beker van
// ESPN — en is daardoor los te testen.
//
// Een wedstrijd ziet er zo uit:
//   { datumISO, competitie: 'ERE'|'KNVB', thuis: 'PSV', uit: 'AJA',
//     home: 1, away: 2, winnaar: 'HOME'|'AWAY'|'DRAW', gespeeld: true,
//     naStrafschoppen: false }
//
// `winnaar` wordt door de aanroeper bepaald, want elke bron noteert een
// strafschoppenserie anders. In de beker telt een nederlaag na strafschoppen
// gewoon als nederlaag.

const EIGEN = 'PSV'

// Hoeveel wedstrijden na de nederlaag we volgen. Twee: daarna vlakt het effect
// af en gaat het verschil op in gewone vormschommelingen.
export const AANTAL_VERVOLG = 2

export function isGespeeld(w) {
  return Boolean(w?.gespeeld)
}

// Speelt deze club mee, en zo ja: thuis of uit?
export function rolVan(wedstrijd, club) {
  if (wedstrijd?.thuis === club) return 'HOME'
  if (wedstrijd?.uit === club) return 'AWAY'
  return null
}

// W (gewonnen), G (gelijk) of V (verloren), gezien vanuit één club.
export function uitslagVoor(wedstrijd, club) {
  const rol = rolVan(wedstrijd, club)
  if (!rol || !isGespeeld(wedstrijd)) return null
  if (wedstrijd.winnaar === 'DRAW') return 'G'
  return wedstrijd.winnaar === rol ? 'W' : 'V'
}

// De wedstrijden op datum, oudste eerst. Overal waar volgorde telt gaat dit
// er doorheen, zodat "de volgende wedstrijd" overal hetzelfde betekent.
export function opDatum(wedstrijden) {
  return [...(wedstrijden || [])]
    .filter(w => w?.datumISO)
    .sort((a, b) => new Date(a.datumISO) - new Date(b.datumISO))
}

// Alle wedstrijden die PSV verloor. Een nederlaag na strafschoppen telt mee:
// dat is de afspraak, en in de beker ga je er net zo hard uit.
export function nederlagen(wedstrijden, club = EIGEN) {
  return opDatum(wedstrijden).filter(w => isGespeeld(w) && uitslagVoor(w, club) === 'V')
}

// De eerstvolgende wedstrijden van een club ná een bepaald moment. Nog niet
// gespeelde wedstrijden tellen mee: bij de laatste nederlaag van dit seizoen
// moet het scherm kunnen zeggen "moet nog komen" in plaats van niets.
export function volgendeVan(wedstrijden, club, naISO, aantal = AANTAL_VERVOLG) {
  const grens = new Date(naISO).getTime()
  return opDatum(wedstrijden)
    .filter(w => rolVan(w, club) && new Date(w.datumISO).getTime() > grens)
    .slice(0, aantal)
}

// Drie punten voor winst, één voor gelijk. Daarmee telt een gelijkspel mee
// als wat het is: twee punten laten liggen. Alleen naar nederlagen kijken zou
// 1-1 gelijkstellen aan een klinkende zege.
export function puntenVoor(wedstrijd, club) {
  const uitslag = uitslagVoor(wedstrijd, club)
  if (uitslag === null) return null
  return uitslag === 'W' ? 3 : uitslag === 'G' ? 1 : 0
}

// Wat haalt deze club normaal per wedstrijd? Dat is de eerlijke maatstaf: de
// clubs die van PSV winnen zijn vaak bovengemiddeld, en dan zegt "weinig
// punten" pas iets als je het afzet tegen hun eigen gemiddelde.
//
// Alles telt mee, ook de zege op PSV en de wedstrijden erna. Over een
// heel seizoen verschuift dat het gemiddelde nauwelijks, en het alternatief
// (die wedstrijden eruit filteren) maakt de uitkomst juist moeilijker uit te
// leggen.
export function gemiddeldePunten(wedstrijden, club) {
  const eigen = opDatum(wedstrijden).filter(w => rolVan(w, club) && isGespeeld(w))
  if (eigen.length === 0) return null
  return eigen.reduce((totaal, w) => totaal + puntenVoor(w, club), 0) / eigen.length
}

// Hoe vaak verliest een club zijn wedstrijd, gemiddeld over alles wat er in
// de lijst staat? Zonder dat getal zegt "7 van de 11" niets: misschien
// verliest iedereen wel vaak. Elke gespeelde wedstrijd levert twee ploegen op
// en hooguit één verliezer.
export function gemiddeldeVerlieskans(wedstrijden) {
  const gespeeld = (wedstrijden || []).filter(isGespeeld)
  if (gespeeld.length === 0) return null
  const beslist = gespeeld.filter(w => w.winnaar !== 'DRAW').length
  return beslist / (2 * gespeeld.length)
}

// Het hele verhaal in één object, klaar om te tonen.
export function maakVloek(wedstrijden, club = EIGEN) {
  const alles = opDatum(wedstrijden)

  const rijen = nederlagen(alles, club).map(verlies => {
    const winnaar = verlies.thuis === club ? verlies.uit : verlies.thuis
    const winnaarNaam = verlies.thuis === club ? verlies.uitNaam : verlies.thuisNaam
    const erna = volgendeVan(alles, winnaar, verlies.datumISO, AANTAL_VERVOLG).map(w => {
      const thuis = w.thuis === winnaar
      // De uitslag vanuit de club zelf, dus hun eigen doelpunten eerst.
      // Anders leest "V 3–0" bij een uitwedstrijd als een overwinning.
      const eigen = thuis ? w.home : w.away
      const tegen = thuis ? w.away : w.home
      return {
        datumISO: w.datumISO,
        datum: w.datum,
        competitie: w.competitie,
        tegenstander: thuis ? w.uit : w.thuis,
        // De naam erbij, want de sleutel van een club die we niet kennen is
        // niet om aan te zien ("~excelsior '31"). In de beker spelen
        // amateurclubs mee, dus dat komt echt voor.
        tegenstanderNaam: (thuis ? w.uitNaam : w.thuisNaam) || '',
        thuis,
        score: isGespeeld(w) ? `${eigen}–${tegen}` : null,
        resultaat: uitslagVoor(w, winnaar),
        punten: puntenVoor(w, winnaar),
        naStrafschoppen: Boolean(w.naStrafschoppen),
        gespeeld: isGespeeld(w),
      }
    })

    const gespeeld = erna.filter(w => w.gespeeld)
    const normaal = gemiddeldePunten(alles, winnaar)
    return {
      verlies,
      winnaar,
      winnaarNaam: winnaarNaam || winnaar,
      erna,
      gepakt: gespeeld.reduce((t, w) => t + w.punten, 0),
      mogelijk: gespeeld.length * 3,
      normaal,
      verwacht: normaal === null ? null : normaal * gespeeld.length,
    }
  })

  // Per vervolgwedstrijd: hoe vaak ging het mis voor de winnaar? De noemer
  // telt alleen wedstrijden die er al zijn — anders zou een nederlaag van
  // vorige week het percentage omlaag trekken puur omdat de rest nog gespeeld
  // moet worden.
  const per = Array.from({ length: AANTAL_VERVOLG }, (_, i) => i).map(i => {
    const bestaand = rijen.map(r => r.erna[i]).filter(w => w && w.gespeeld)
    const gepakt = bestaand.reduce((t, w) => t + w.punten, 0)
    return {
      nr: i + 1,
      verloren: bestaand.filter(w => w.resultaat === 'V').length,
      van: bestaand.length,
      gepakt,
      mogelijk: bestaand.length * 3,
      gelaten: bestaand.length * 3 - gepakt,
    }
  })

  const treffers = per.reduce((t, p) => t + p.verloren, 0)
  const kansen = per.reduce((t, p) => t + p.van, 0)
  const gepakt = rijen.reduce((t, r) => t + r.gepakt, 0)
  const mogelijk = rijen.reduce((t, r) => t + r.mogelijk, 0)

  // Wat hadden ze normaal gehaald? Per club zijn eigen gemiddelde, maal het
  // aantal wedstrijden dat er voor hen al gespeeld is.
  const metNormaal = rijen.filter(r => r.verwacht !== null)
  const verwacht = metNormaal.reduce((t, r) => t + r.verwacht, 0)

  return {
    rijen: [...rijen].reverse(), // nieuwste nederlaag bovenaan
    samenvatting: {
      nederlagen: rijen.length,
      per,
      treffers,
      kansen,
      vloekKans: kansen > 0 ? treffers / kansen : null,
      gemiddeld: gemiddeldeVerlieskans(alles),
      gepakt,
      mogelijk,
      gelaten: mogelijk - gepakt,
      perWedstrijd: kansen > 0 ? gepakt / kansen : null,
      normaalPerWedstrijd: kansen > 0 && metNormaal.length === rijen.length ? verwacht / kansen : null,
      tekort: metNormaal.length === rijen.length ? verwacht - gepakt : null,
    },
  }
}
