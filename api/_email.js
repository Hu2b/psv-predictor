const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM = process.env.RESEND_FROM_EMAIL || 'PSV Poule <onboarding@resend.dev>'
const APP_URL = process.env.APP_BASE_URL || 'https://psv-predictor.vercel.app'

async function verstuurMail(to, subject, html) {
  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY ontbreekt, e-mail niet verstuurd. Onderwerp:', subject, 'Naar:', to)
    return
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    })
    if (!res.ok) {
      const tekst = await res.text()
      console.error('Resend gaf een foutstatus:', res.status, tekst)
    }
  } catch (err) {
    console.error('Versturen van e-mail via Resend mislukt:', err)
  }
}

export async function stuurVerificatieMail(email, naam, token) {
  const link = `${APP_URL}/?verify=${token}`
  await verstuurMail(email, 'Bevestig je PSV Poule account', `
    <p>Hoi ${naam},</p>
    <p>Bevestig je e-mailadres om je PSV Poule account te activeren:</p>
    <p><a href="${link}">${link}</a></p>
    <p>Deze link is 24 uur geldig.</p>
  `)
}

export async function stuurResetLinkMail(email, naam, token) {
  const link = `${APP_URL}/?reset=${token}`
  await verstuurMail(email, 'Nieuwe pincode instellen — PSV Poule', `
    <p>Hoi ${naam},</p>
    <p>Klik op onderstaande link om een nieuwe pincode in te stellen:</p>
    <p><a href="${link}">${link}</a></p>
    <p>Deze link is 1 uur geldig. Heb je dit niet aangevraagd, negeer deze e-mail dan.</p>
  `)
}

export async function stuurPincodeGewijzigdMail(email, naam) {
  await verstuurMail(email, 'Je pincode is gewijzigd — PSV Poule', `
    <p>Hoi ${naam},</p>
    <p>Je pincode is zojuist gewijzigd. Was jij dit niet? Neem dan contact op met de beheerder.</p>
  `)
}

export async function stuurAccountVerwijderdMail(email, naam) {
  await verstuurMail(email, 'Je PSV Poule account is verwijderd', `
    <p>Hoi ${naam},</p>
    <p>Je account is verwijderd door een beheerder van PSV Poule.</p>
    <p>Heb je hier vragen over, neem dan contact op met de beheerder.</p>
  `)
}

export async function stuurNieuwePincodeDoorBeheerderMail(email, naam, nieuwePincode) {
  await verstuurMail(email, 'Je pincode is gereset door een beheerder', `
    <p>Hoi ${naam},</p>
    <p>Een beheerder heeft je pincode gereset. Je nieuwe pincode is:</p>
    <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${nieuwePincode}</p>
    <p>Log in met deze pincode en wijzig hem eventueel naar iets dat je zelf kunt onthouden.</p>
  `)
}

export async function stuurBeheerderMeldingMail(email, onderwerpTekst, inhoudTekst) {
  await verstuurMail(email, `[PSV Poule beheer] ${onderwerpTekst}`, `
    <p>${inhoudTekst}</p>
  `)
}

// Verstuurt de mail(s) naar de betrokken speler EN de audit-mail naar alle
// beheerders, allemaal gelijktijdig — voorkomt dat een trage e-mailservice
// (of veel beheerders) de serverless-functie laat vasthangen tot een timeout.
export async function stuurBeheerNotificaties(spelerMailPromises, adminEmails, onderwerpTekst, inhoudTekst) {
  await Promise.allSettled([
    ...spelerMailPromises,
    ...adminEmails.map(email => stuurBeheerderMeldingMail(email, onderwerpTekst, inhoudTekst)),
  ])
}

export async function stuurEmailWijzigingVerificatieMail(nieuwEmail, naam, token) {
  const link = `${APP_URL}/?bevestigEmail=${token}`
  await verstuurMail(nieuwEmail, 'Bevestig je nieuwe e-mailadres — PSV Poule', `
    <p>Hoi ${naam},</p>
    <p>Klik op onderstaande link om dit e-mailadres te koppelen aan je PSV Poule account:</p>
    <p><a href="${link}">${link}</a></p>
    <p>Deze link is 24 uur geldig. Heb je dit niet aangevraagd, negeer deze e-mail dan.</p>
  `)
}

export async function stuurEmailGewijzigdMail(oudEmail, nieuwEmail, naam) {
  const bericht = `
    <p>Hoi ${naam},</p>
    <p>Je e-mailadres is gewijzigd naar <strong>${nieuwEmail}</strong>.</p>
    <p>Je kunt inloggen op PSV Poule via: <a href="${APP_URL}">${APP_URL}</a></p>
    <p>Was jij dit niet? Neem dan contact op met de beheerder.</p>
  `
  await Promise.allSettled([
    verstuurMail(oudEmail, 'Je e-mailadres is gewijzigd — PSV Poule', bericht),
    verstuurMail(nieuwEmail, 'Je e-mailadres is gewijzigd — PSV Poule', bericht),
  ])
}

// Persoonlijke uitslagmelding per speler: eindstand, eigen voorspelling,
// behaalde punten en de nieuwe positie in het klassement. Wordt gebruikt als
// terugval wanneer WhatsApp (nog) niet is ingesteld, of voor spelers zonder
// telefoonnummer.
export async function stuurUitslagMail(email, g) {
  const onderwerp = g.isCorrectie
    ? `Gecorrigeerde uitslag: ${g.wedstrijd} — PSV Poule`
    : `Uitslag: ${g.wedstrijd} — PSV Poule`
  await verstuurMail(email, onderwerp, `
    <p>Hoi ${g.naam},</p>
    ${g.isCorrectie ? '<p><strong>Let op: de uitslag van deze wedstrijd is gecorrigeerd. Dit zijn de bijgewerkte punten.</strong></p>' : ''}
    <p>⚽ <strong>${g.wedstrijd}</strong></p>
    <p>Eindstand: <strong>${g.eindstand}</strong></p>
    <p>Jouw voorspelling: <strong>${g.voorspelling}</strong> → <strong>${g.punten} punten</strong></p>
    <p><strong>🏆 Nieuwe stand</strong></p>
    <table style="border-collapse: collapse;">
      ${(g.klassement || []).map(r => `
        <tr style="${r.playerId === g.playerId ? 'font-weight: bold;' : ''}">
          <td style="padding: 2px 10px 2px 0;">${r.positie}.</td>
          <td style="padding: 2px 16px 2px 0;">${r.naam}</td>
          <td style="padding: 2px 0;">${r.punten}</td>
        </tr>`).join('')}
    </table>
    <p>Bekijk het volledige overzicht op <a href="${APP_URL}">${APP_URL}</a></p>
  `)
}
