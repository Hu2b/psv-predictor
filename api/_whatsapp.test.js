import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  naarWhatsappAdres,
  maakVariabeleVeilig,
  maakContentVariables,
  sjabloonSid,
  SJABLOON_UITSLAG,
  SJABLOON_VOORSPELLINGEN,
  whatsappIngesteld,
  whatsappInstellingen,
} from './_whatsapp.js'

const SLEUTELS = [
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_WHATSAPP_FROM',
  'TWILIO_CONTENT_SID',
  'TWILIO_CONTENT_SID_VOORSPELLINGEN',
]

// Zet de vier omgevingsvariabelen voor de duur van één test en herstelt ze
// daarna, zodat de tests elkaar niet beïnvloeden.
function metOmgeving(waarden, fn) {
  const origineel = Object.fromEntries(SLEUTELS.map(k => [k, process.env[k]]))
  try {
    for (const k of SLEUTELS) {
      if (waarden[k] === undefined) delete process.env[k]
      else process.env[k] = waarden[k]
    }
    fn()
  } finally {
    for (const k of SLEUTELS) {
      if (origineel[k] === undefined) delete process.env[k]
      else process.env[k] = origineel[k]
    }
  }
}

const VOLLEDIG = {
  TWILIO_ACCOUNT_SID: 'ACtest',
  TWILIO_AUTH_TOKEN: 'geheim',
  TWILIO_WHATSAPP_FROM: '+14155238886',
  TWILIO_CONTENT_SID: 'HXtest',
}

test('naarWhatsappAdres: kale cijfers, plus en spaties leveren hetzelfde adres', () => {
  assert.equal(naarWhatsappAdres('31651972949'), 'whatsapp:+31651972949')
  assert.equal(naarWhatsappAdres('+31651972949'), 'whatsapp:+31651972949')
  assert.equal(naarWhatsappAdres('+31 6 5197 2949'), 'whatsapp:+31651972949')
})

test('naarWhatsappAdres: zonder nummer een lege string, nooit "whatsapp:+"', () => {
  assert.equal(naarWhatsappAdres(null), '')
  assert.equal(naarWhatsappAdres(''), '')
  assert.equal(naarWhatsappAdres('geen cijfers'), '')
})

test('maakVariabeleVeilig: regeleindes en tabs worden platgeslagen', () => {
  const regel = maakVariabeleVeilig('Huub 2-1\n\tNiek 1-1    Sam 0-0')
  assert.equal(regel, 'Huub 2-1 Niek 1-1 Sam 0-0')
  // WhatsApp weigert sjabloonvariabelen met een regeleinde of tab.
  assert.ok(!/[\n\r\t]/.test(regel))
})

test('maakVariabeleVeilig: te lange waarden worden afgekapt', () => {
  const lang = maakVariabeleVeilig('x'.repeat(2000))
  assert.equal(lang.length, 900)
  assert.ok(lang.endsWith('…'))
})

test('maakContentVariables: genummerd op volgorde, als JSON', () => {
  const json = maakContentVariables(['PSV – Ajax', '2-1', 'Huub 2-1 (10 pt)', '1. Huub 48'])
  assert.deepEqual(JSON.parse(json), {
    1: 'PSV – Ajax',
    2: '2-1',
    3: 'Huub 2-1 (10 pt)',
    4: '1. Huub 48',
  })
})

test('maakContentVariables: lege lijst levert een leeg object', () => {
  assert.equal(maakContentVariables([]), '{}')
  assert.equal(maakContentVariables(undefined), '{}')
})

test('whatsappIngesteld: account, token en afzender zijn alle drie nodig', () => {
  metOmgeving(VOLLEDIG, () => assert.equal(whatsappIngesteld(), true))
  for (const ontbrekend of ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_WHATSAPP_FROM']) {
    metOmgeving({ ...VOLLEDIG, [ontbrekend]: undefined }, () => {
      assert.equal(whatsappIngesteld(), false, `zonder ${ontbrekend} mag het niet ingesteld heten`)
    })
  }
})

test('whatsappIngesteld: zonder sjabloon blijft het ingesteld, maar in vrije-tekstmodus', () => {
  metOmgeving({ ...VOLLEDIG, TWILIO_CONTENT_SID: undefined }, () => {
    assert.equal(whatsappIngesteld(), true)
    assert.equal(whatsappInstellingen().modus, 'vrije tekst')
  })
  metOmgeving(VOLLEDIG, () => assert.equal(whatsappInstellingen().modus, 'sjabloon'))
})

test('sjabloonSid: elke soort melding heeft zijn eigen sjabloon', () => {
  metOmgeving({ ...VOLLEDIG, TWILIO_CONTENT_SID_VOORSPELLINGEN: 'HXvoorspel' }, () => {
    assert.equal(sjabloonSid(SJABLOON_UITSLAG), 'HXtest')
    assert.equal(sjabloonSid(SJABLOON_VOORSPELLINGEN), 'HXvoorspel')
  })
})

test('sjabloonSid: een ontbrekend sjabloon geeft een lege string, geen undefined', () => {
  metOmgeving({ ...VOLLEDIG, TWILIO_CONTENT_SID_VOORSPELLINGEN: undefined }, () => {
    assert.equal(sjabloonSid(SJABLOON_VOORSPELLINGEN), '')
  })
})

test('whatsappInstellingen: toont wat ontbreekt maar lekt het Auth Token niet', () => {
  metOmgeving(VOLLEDIG, () => {
    const i = whatsappInstellingen()
    assert.equal(i.ingesteld, true)
    assert.equal(i.aanbieder, 'twilio')
    assert.equal(i.tokenAanwezig, true)
    assert.equal(i.afzender, '+14155238886')
    assert.equal(i.sjabloon, 'HXtest')
    assert.ok(!JSON.stringify(i).includes('geheim'))
  })
})

test('whatsappInstellingen: een ontbrekend sjabloon is zichtbaar als —', () => {
  metOmgeving({ ...VOLLEDIG, TWILIO_CONTENT_SID: undefined }, () => {
    const i = whatsappInstellingen()
    assert.equal(i.sjabloonAanwezig, false)
    assert.equal(i.sjabloon, '')
    assert.equal(i.accountAanwezig, true)
    assert.equal(i.afzenderAanwezig, true)
  })
})
