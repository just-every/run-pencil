import { contactCountryCodes } from './contactAddress'

export type ListChoice = { value: string; label: string }

const stateNames = `AL|Alabama
AK|Alaska
AZ|Arizona
AR|Arkansas
CA|California
CO|Colorado
CT|Connecticut
DE|Delaware
FL|Florida
GA|Georgia
HI|Hawaii
ID|Idaho
IL|Illinois
IN|Indiana
IA|Iowa
KS|Kansas
KY|Kentucky
LA|Louisiana
ME|Maine
MD|Maryland
MA|Massachusetts
MI|Michigan
MN|Minnesota
MS|Mississippi
MO|Missouri
MT|Montana
NE|Nebraska
NV|Nevada
NH|New Hampshire
NJ|New Jersey
NM|New Mexico
NY|New York
NC|North Carolina
ND|North Dakota
OH|Ohio
OK|Oklahoma
OR|Oregon
PA|Pennsylvania
RI|Rhode Island
SC|South Carolina
SD|South Dakota
TN|Tennessee
TX|Texas
UT|Utah
VT|Vermont
VA|Virginia
WA|Washington
WV|West Virginia
WI|Wisconsin
WY|Wyoming
DC|District of Columbia
AS|American Samoa
GU|Guam
MP|Northern Mariana Islands
PR|Puerto Rico
VI|U.S. Virgin Islands`

const countryNames = new Intl.DisplayNames(['en-US'], { type: 'region' })
export const countryChoices: ListChoice[] = contactCountryCodes.map(value => ({ value, label: countryNames.of(value)! }))
  .sort((left, right) => left.label.localeCompare(right.label, 'en-US'))
export const usStateChoices: ListChoice[] = stateNames.split('\n').map(line => {
  const [value, label] = line.split('|')
  return { value, label }
}).sort((left, right) => left.label.localeCompare(right.label, 'en-US'))

export const choiceLists = {
  'us-states': { label: 'US states, DC and territories', choices: usStateChoices },
  countries: { label: 'Countries', choices: countryChoices },
} as const
