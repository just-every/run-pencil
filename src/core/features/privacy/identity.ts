export { privacyIdentifier, privacyEmailHash } from '../../shared/privacyIdentity'

// Exact contact values only: a name or a substring never selects another person's data.
export const identifierCte = `WITH identifiers AS (SELECT json_extract(value,'$.kind') AS kind,json_extract(value,'$.value') AS value FROM json_each(?))`
export function matchingValue(expression: string) {
  const phone = [' ', '+', '-', '.', '(', ')'].reduce((sql, character) => `replace(${sql},'${character}','')`, `trim(CAST(${expression} AS TEXT))`)
  return `EXISTS(SELECT 1 FROM identifiers i WHERE (i.kind='email' AND lower(trim(CAST(${expression} AS TEXT)))=i.value) OR (i.kind='phone' AND ${phone}=i.value))`
}
export const matchingJson = (expression: string) => `EXISTS(SELECT 1 FROM json_tree(COALESCE(${expression},'{}')) identity_value WHERE identity_value.type='text' AND ${matchingValue('identity_value.atom')})`
