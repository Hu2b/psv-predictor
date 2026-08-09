// Eén centrale plek voor het sessietoken in de browser. Voorheen stond de
// sleutel als los stringliteral in elk component; een wijziging (of een typo)
// moest dan overal tegelijk goed gaan. Nu is er één bron van waarheid.
const SESSION_KEY = 'psv_session_token'

export function getSessionToken() {
  return localStorage.getItem(SESSION_KEY)
}

export function setSessionToken(token) {
  localStorage.setItem(SESSION_KEY, token)
}

export function clearSessionToken() {
  localStorage.removeItem(SESSION_KEY)
}
