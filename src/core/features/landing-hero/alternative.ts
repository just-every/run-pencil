/**
 * What Pencil replaces, as one line under the hero's lede and at the head of the page description, so a person
 * looking for one of these tools finds it. Nominative: it names the incumbents and makes no comparison. Pencil is MIT
 * and charges nothing. The same names are `replaces` in seed.json. The hero shows the names in bold with each name's
 * words joined by a no-break space; `alternativeLine` is the same words as plain text for the page description.
 */
export const alternativeLead = '100% free, open source alternative to'
export const alternativeNames = ['Typeform', 'Google Forms', 'Jotform'] as const
export const alternativeLine = `${alternativeLead} ${alternativeNames.slice(0, -1).join(', ')} and ${alternativeNames[alternativeNames.length - 1]}`
