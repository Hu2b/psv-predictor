# PSV Poule

Een voorspel-app voor een kleine, besloten poule (max. 10 spelers): voorspel
de uitslagen van PSV-wedstrijden (Eredivisie + Champions League), verdien
punten en volg het klassement. Wedstrijden en (live)standen komen automatisch
binnen; een beheerder kan daarnaast handmatig wedstrijden en uitslagen beheren.

## Techniek

- **Frontend:** React 18 + Vite (single-page app, `src/`).
- **Backend:** serverless functions op Vercel (`api/`), geen apart framework.
- **Opslag:** Vercel KV / Upstash Redis, benaderd via de REST-API (`api/_kv.js`).
- **Externe data:** [football-data.org](https://www.football-data.org/) voor
  wedstrijden, live-standen en onderlinge duels.
- **E-mail:** [Resend](https://resend.com/) voor verificatie-, reset- en
  meldingsmails.
- **Hosting/cron:** Vercel (incl. een dagelijkse cron-job voor uitslagen).

## Puntentelling

Per wedstrijd (zie `api/_scoring.js`):

- Juiste toto (1 / gelijkspel / 2): **5 punten**
- Exact juiste eindstand: **nog eens 5 punten** (dus samen 10)
- Precies één juist scoregetal (thuis óf uit), zonder exacte stand: **2 punten**

Voorspellingen van andere spelers blijven verborgen tot de aftrap, of tot
iedereen heeft voorspeld, of tot de uitslag is vastgelegd — pas dan worden ze
"onthuld".

## Projectstructuur

```
api/         Serverless functions (endpoints) + gedeelde server-modules (_*.js)
src/         React-app: components, hooks en helpers (src/lib/)
shared/      Modules die zowel door api/ als src/ gebruikt worden
             (teamnamen/-logo's, competitienamen)
public/      Statische assets (icons, manifest, logo's)
```

Server-modules met een `_`-prefix (bijv. `_kv.js`, `_auth.js`, `_wedstrijden.js`)
zijn interne helpers, geen HTTP-endpoints.

### Belangrijkste endpoints

| Endpoint                | Doel                                                        |
|-------------------------|-------------------------------------------------------------|
| `GET  /api/fixtures`    | Alle PSV-wedstrijden (verwerkt en passant nieuwe uitslagen) |
| `GET  /api/livescore`   | Live-/eindstand van één wedstrijd                           |
| `GET  /api/h2h`         | Laatste onderlinge ontmoetingen                             |
| `GET/POST /api/prediction` | Eigen voorspelling ophalen/opslaan (sessie vereist)      |
| `GET  /api/results`     | Klassement en verwerkte resultaten                          |
| `GET  /api/players`     | Publieke spelerslijst (id + naam)                           |
| `*    /api/auth`        | Registreren, inloggen, sessie, wachtwoord/e-mail beheren    |
| `*    /api/admin`       | Beheer van wedstrijden en uitslagen (beheerderssessie)      |
| `*    /api/admin-players` | Beheer van spelers (beheerderssessie + pincode)           |
| `GET  /api/cron-uitslagen` | Cron-vangnet dat uitslagen verwerkt (zie `vercel.json`)  |

## Omgevingsvariabelen

Nodig in productie (Vercel → Project → Settings → Environment Variables):

| Variabele            | Verplicht | Doel                                                        |
|----------------------|-----------|-------------------------------------------------------------|
| `FOOTBALL_DATA_KEY`  | ja        | API-sleutel van football-data.org                           |
| `KV_REST_API_URL`    | ja        | REST-URL van Vercel KV / Upstash                            |
| `KV_REST_API_TOKEN`  | ja        | REST-token van Vercel KV / Upstash                          |
| `RESEND_API_KEY`     | ja        | API-sleutel voor het versturen van e-mail via Resend        |
| `RESEND_FROM_EMAIL`  | nee       | Afzender (standaard een resend.dev-adres)                   |
| `APP_BASE_URL`       | nee       | Basis-URL voor e-maillinks én de toegestane CORS-origin     |
| `ADMIN_EMAILS`       | nee       | Kommagescheiden lijst van beheerders-e-mailadressen         |
| `CRON_SECRET`        | aanbevolen| Beschermt `/api/cron-uitslagen` (Vercel stuurt 'm mee)      |
| `PSV_SEASON`         | nee       | Forceert een seizoen i.p.v. automatisch bepalen             |
| `TWILIO_ACCOUNT_SID` | nee       | Account SID uit de Twilio Console (zie hieronder)           |
| `TWILIO_AUTH_TOKEN`  | nee       | Auth Token uit de Twilio Console                            |
| `TWILIO_WHATSAPP_FROM` | nee     | De WhatsApp-afzender, bijv. `+14155238886`                  |
| `TWILIO_CONTENT_SID` | nee       | SID van het goedgekeurde sjabloon (begint met `HX`)         |

## Meldingen na een uitslag

Zodra een uitslag verwerkt is, krijgt elke speler die meldingen aan heeft staan
(Account → Meldingen) een bericht met de eindstand, zijn eigen voorspelling,
de behaalde punten en het nieuwe klassement.

Het kanaal volgt vanzelf uit de instellingen:

- Zijn alle vier de `TWILIO_*`-variabelen gezet **en** heeft de speler een
  telefoonnummer ingevuld → **WhatsApp**.
- Anders → **e-mail** (via Resend).

### WhatsApp instellen (via Twilio)

De berichten lopen via **Twilio**, niet rechtstreeks via Meta. Om zelf een
WhatsApp Business Account aan te maken moet je bedrijfsportfolio door Meta's
beleidscontrole komen; voor een particulier zonder ingeschreven bedrijf loopt
dat vast op foutcode 2494070. Twilio is een door Meta erkende Business Solution
Provider en regelt die kant.

1. Een **Twilio-account** met saldo en een **WhatsApp-afzender**
   (Messaging → Senders → WhatsApp senders). Dat kan het gratis sandbox-nummer
   zijn om mee te testen, of een eigen nummer voor productie.
2. **Account SID** en **Auth Token** uit de Twilio Console →
   `TWILIO_ACCOUNT_SID` en `TWILIO_AUTH_TOKEN`.
3. Het afzendernummer → `TWILIO_WHATSAPP_FROM` (bijv. `+14155238886`; de app
   zet er zelf `whatsapp:` voor).
4. Een **goedgekeurd sjabloon**, bij Twilio een *Content Template*. Berichten
   die wij beginnen moeten een sjabloon gebruiken; vrije tekst mag alleen
   binnen 24 uur nadat de ontvanger zelf iets stuurde. Maak in de Content
   Template Builder een template van type *Text*, categorie *Utility*, met deze
   body:

```
⚽ {{1}}
Eindstand: {{2}}

Voorspellingen: {{3}}

🏆 Nieuwe stand: {{4}}
```

   Dien hem in ter goedkeuring bij WhatsApp en zet de **ContentSid** (begint
   met `HX`) in `TWILIO_CONTENT_SID`.

De vier variabelen worden in deze volgorde gevuld:

1. de wedstrijd (`PSV Eindhoven – Ajax`)
2. de eindstand (`2-1`)
3. de voorspellingen en punten van alle deelnemers, op één regel
   (`Huub 2-1 (10 pt) · Niek 1-1 (0 pt)`)
4. het klassement, op één regel (`1. Huub 48 · 2. Niek 45`)

> Let op: een sjabloonvariabele mag géén regeleinde, tab of vier of meer spaties
> achter elkaar bevatten — vandaar dat het klassement op één regel staat. De app
> maakt elke variabele daar automatisch geschikt voor.

## Lokaal ontwikkelen

```bash
npm install
npm run dev          # start Vite op http://localhost:5173
```

`vite.config.js` proxyt `/api` naar `http://localhost:3000`; draai de API's
lokaal met `vercel dev` (Vercel CLI) als je de endpoints wilt aanroepen. Zet de
omgevingsvariabelen hierboven in een `.env`-bestand voor lokale runs.

## Testen

Unit-tests draaien op de ingebouwde testrunner van Node (geen extra
dependency):

```bash
npm test
```

De tests dekken de pure logica (`api/_scoring.js`, `shared/competities.js`,
`shared/teams.js`).

## Bouwen & deployen

```bash
npm run build        # productie-build naar dist/
```

Deployen gebeurt automatisch door Vercel bij een push naar `main`. De
GitHub Actions-workflow (`.github/workflows/ci.yml`) draait bij elke push en
pull request `npm test` en `npm run build`.
