import manifest from '../../../../seed.json'
import { sqlTextWithin } from './textValidity'
import { parseTextPattern, textWhitespaceUnits, type TextPatternAtom } from '../../shared/textValidation'

const shortTextLimit = manifest.limits.responses.shortTextCharactersPerAnswer
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`
// Decode bytes rather than SQLite text indexes: JS admission counts UTF-16 units,
// including surrogate pairs and embedded NUL. JSON also admits lone surrogates.
function utf16Units(value: string) {
  const byte = (offset: number) => `(16*(instr('0123456789ABCDEF',substr(hex(data),2*(bytePos+${offset})-1,1))-1)+(instr('0123456789ABCDEF',substr(hex(data),2*(bytePos+${offset}),1))-1))`
  const first = byte(0)
  const width = `CASE WHEN ${first}<128 THEN 1 WHEN ${first}<224 THEN 2 WHEN ${first}<240 THEN 3 ELSE 4 END`
  const code = `CASE WHEN ${first}<128 THEN ${first} WHEN ${first}<224 THEN (${first}-192)*64+${byte(1)}-128 WHEN ${first}<240 THEN (${first}-224)*4096+(${byte(1)}-128)*64+${byte(2)}-128 ELSE (${first}-240)*262144+(${byte(1)}-128)*4096+(${byte(2)}-128)*64+${byte(3)}-128 END`
  return `input(data) AS MATERIALIZED (SELECT CAST(${value} AS BLOB)),
    points(bytePos,position) AS (VALUES(1,1) UNION ALL SELECT bytePos+(${width}),position+CASE WHEN ${first}>=240 THEN 2 ELSE 1 END FROM points,input WHERE bytePos<=length(data)),
    decoded(position,code) AS MATERIALIZED (SELECT position,${code} FROM points,input WHERE bytePos<=length(data)),
    units(position,unit) AS MATERIALIZED (SELECT position,CASE WHEN code>65535 THEN 55296+CAST((code-65536)/1024 AS INTEGER) ELSE code END FROM decoded
      UNION ALL SELECT position+1,56320+(code-65536)%1024 FROM decoded WHERE code>65535)`
}

/** Exact concatenation-pattern NFA. UNION deduplicates reachable states; bounded
 * text and atoms bound the state space, without regex/backtracking extensions.
 */
type SqlAtom = Pick<TextPatternAtom, 'min' | 'max' | 'ranges' | 'negate'>
function sqlAtomsMatch(value: string, atoms: SqlAtom[]) {
  if (atoms.every(atom => atom.min === atom.max)) {
    const length = atoms.reduce((total, atom) => total + atom.min, 0)
    if (length > shortTextLimit) return '0'
    const fixed = atoms.flatMap(atom => Array.from({ length: atom.min }, () => ({ negate: atom.negate ? 1 : 0, ranges: atom.ranges })))
    return `(WITH RECURSIVE ${utf16Units(value)},
      atoms AS MATERIALIZED (SELECT CAST(key AS INTEGER)+1 AS position,json_extract(value,'$.negate') AS negate,json_extract(value,'$.ranges') AS ranges FROM json_each(${literal(JSON.stringify(fixed))}))
      SELECT COALESCE((SELECT MAX(position) FROM units),0)=${length}
        AND NOT EXISTS(SELECT 1 FROM units u JOIN atoms a ON a.position=u.position WHERE (EXISTS(SELECT 1 FROM json_each(a.ranges) r WHERE u.unit BETWEEN json_extract(r.value,'$[0]') AND json_extract(r.value,'$[1]'))) = a.negate))`
  }
  const encoded = atoms.map(atom => ({ min: atom.min, max: Number.isFinite(atom.max) ? atom.max : shortTextLimit, negate: atom.negate ? 1 : 0, ranges: atom.ranges }))
  return `(WITH RECURSIVE ${utf16Units(value)},
    atoms AS MATERIALIZED (SELECT CAST(key AS INTEGER) AS number,json_extract(value,'$.min') AS minimum,json_extract(value,'$.max') AS maximum,json_extract(value,'$.negate') AS negate,json_extract(value,'$.ranges') AS ranges FROM json_each(${literal(JSON.stringify(encoded))})),
    states(atom,position,repetitions) AS (VALUES(0,0,0)
      UNION SELECT st.atom+1,st.position,0 FROM states st JOIN atoms a ON a.number=st.atom WHERE st.repetitions>=a.minimum
      UNION SELECT st.atom,st.position+1,st.repetitions+1 FROM states st JOIN atoms a ON a.number=st.atom JOIN units u ON u.position=st.position+1
        WHERE st.repetitions<a.maximum AND (EXISTS(SELECT 1 FROM json_each(a.ranges) r WHERE u.unit BETWEEN json_extract(r.value,'$[0]') AND json_extract(r.value,'$[1]'))) != a.negate)
    SELECT EXISTS(SELECT 1 FROM states WHERE atom=${atoms.length} AND position=COALESCE((SELECT MAX(position) FROM units),0)))`
}
function maskAtoms(mask: string): SqlAtom[] {
  return mask.split('').map<SqlAtom>(character => ({ min: 1, max: 1, negate: false,
    ranges: character === '#' ? [[48,57]] : character === '@' ? [[65,90],[97,122]] : character === '*' ? [[48,57],[65,90],[97,122]] : [[character.charCodeAt(0),character.charCodeAt(0)]] }))
}

/** Settings were checked with the same parser before this SQL is built. */
export function sqlOtherTextConstraints(settings: Record<string, unknown>, value: string) {
  const clauses: string[] = []
  if (typeof settings.minLength === 'number' || typeof settings.maxLength === 'number') {
    const min = typeof settings.minLength === 'number' ? settings.minLength : 0
    const max = typeof settings.maxLength === 'number' ? settings.maxLength : shortTextLimit
    clauses.push(sqlTextWithin(value, max))
    if (min > 0) clauses.push(`NOT (${sqlTextWithin(value, min - 1)})`)
  }
  if (typeof settings.inputMask === 'string') clauses.push(sqlAtomsMatch(value, maskAtoms(settings.inputMask)))
  if (typeof settings.pattern === 'string') {
    const atoms = parseTextPattern(settings.pattern)
    if (!atoms) throw new Error('Invalid retained Other text pattern.')
    clauses.push(sqlAtomsMatch(value, atoms))
  }
  return clauses.length ? clauses.join(' AND ') : '1'
}

export const sqlTextWhitespace = textWhitespaceUnits.join(',')
