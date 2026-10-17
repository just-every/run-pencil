import { contactSchemas, contactText, invalidContactText, objectIssues, type AddressAnswer, type ContactFieldIssues, type NameAnswer } from './contactSchemas'

export const usPostalStates = 'AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC AS GU MP PR VI FM MH PW AA AE AP'.split(' ')
export const contactCountryCodes = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ')

export function addressIssues(value: unknown): ContactFieldIssues {
  const issues = objectIssues(contactSchemas.postal_address, value)
  if (Object.keys(issues).length) return issues
  const answer = value as AddressAnswer
  for (const field of ['street', 'city'] as const) if (!contactText(answer[field])) issues[field] = `Enter a ${field === 'street' ? 'street address' : 'city'}.`
  for (const [field, text] of Object.entries(answer)) if (invalidContactText(text)) issues[field] = 'Enter text without line breaks or control characters.'
  const country = contactText(answer.country).toUpperCase()
  if (!contactCountryCodes.includes(country)) issues.country = 'Choose a valid two-letter country code.'
  if (country === 'US') {
    if (!usPostalStates.includes(contactText(answer.state).toUpperCase())) issues.state = 'Enter a valid two-letter US state or territory code.'
    if (!/^\d{5}(?:-?\d{4})?$/.test(contactText(answer.postalCode))) issues.postalCode = 'Enter a five-digit ZIP or nine-digit ZIP+4.'
  }
  return issues
}

export function normalizeAddress(value: AddressAnswer): AddressAnswer {
  const country = contactText(value.country).toUpperCase(), postal = contactText(value.postalCode), unit = value.unit && contactText(value.unit)
  return { street: contactText(value.street), ...(unit ? { unit } : {}), city: contactText(value.city), state: country === 'US' ? contactText(value.state).toUpperCase() : contactText(value.state), postalCode: country === 'US' && /^\d{9}$/.test(postal) ? `${postal.slice(0, 5)}-${postal.slice(5)}` : postal, country }
}

export function nameIssues(value: unknown): ContactFieldIssues {
  const issues = objectIssues(contactSchemas.full_name, value)
  if (Object.keys(issues).length) return issues
  const answer = value as NameAnswer
  if (!contactText(answer.given)) issues.given = 'Enter a given name.'
  if (!contactText(answer.family)) issues.family = 'Enter a family name.'
  for (const [field, text] of Object.entries(answer)) if (invalidContactText(text)) issues[field] = 'Enter a name without line breaks or control characters.'
  return issues
}

export function normalizeName(value: NameAnswer): NameAnswer {
  const middle = value.middle && contactText(value.middle), suffix = value.suffix && contactText(value.suffix)
  return { given: contactText(value.given), ...(middle ? { middle } : {}), family: contactText(value.family), ...(suffix ? { suffix } : {}) }
}
