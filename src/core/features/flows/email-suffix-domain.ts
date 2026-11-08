import { normalizeConditionText, type Condition } from '../../shared/conditions'

type Requirement = { condition: Extract<Condition, { kind: 'test' }>; matched: boolean }

/** Solve one present email's correlated equality and suffix requirements.
 * Positive suffixes form a chain: only the longest can constrain a witness.
 * A fresh ordinary character in the prefix cannot introduce an excluded suffix
 * or equality. Together with @ and dot it represents every email syntax class;
 * at most five prefix characters complete any suffix to the admitted syntax.
 * The shared admission check, rather than a guessed domain rule, checks each
 * witness and its raw 200-character bound.
 */
export function emailConditionPossible(requirements: Requirement[], valid: (value: unknown) => boolean, satisfies: (value: unknown) => boolean, proof: { spend: () => void; refuse: (reason: string) => never }): boolean {
  const values = requirements.map(({ condition, matched }) => ({
    operator: condition.operator, matched, raw: String(condition.value),
    value: normalizeConditionText(String(condition.value)),
  }))
  const equalities = values.filter(test => test.operator === 'equals' ? test.matched : test.operator === 'not_equals' && !test.matched)
  const suffixes = values.filter(test => test.operator === 'ends_with' && test.matched).map(test => test.value).sort((a, b) => b.length - a.length)
  const tail = suffixes[0] ?? ''
  if (suffixes.some(suffix => !tail.endsWith(suffix))) return false
  if (values.some(test => test.operator === 'ends_with' && !test.matched && tail.endsWith(test.value))) return false
  const some = (candidates: string[]) => candidates.some(value => {
    proof.spend()
    return valid(value) && satisfies(value)
  })
  // Lowercasing U+0130 expands to two code units. Retain the shorter raw
  // preimage when the admission length is tight; verify it with the evaluator.
  const preimages = (value: string) => [value, value.replaceAll('i\u0307', '\u0130')]
  if (equalities.length) {
    const first = equalities[0].value
    if (equalities.some(test => test.value !== first)) return false
    if (values.some(test => test.operator === 'ends_with' && first.endsWith(test.value) !== test.matched || ['equals', 'not_equals'].includes(test.operator) && (first === test.value) !== (test.operator === 'equals' ? test.matched : !test.matched))) return false
    if (some(equalities.flatMap(test => [test.raw.trim().normalize('NFC'), ...preimages(first)]))) return true
    if (/[^\x00-\x7f]/.test(first)) return proof.refuse('Exact email condition reachability could not establish an admitted normalized equality. Simplify the condition before publishing.')
    return false
  }
  const used = values.map(test => test.value).join('')
  let fresh = 'a'
  for (let code = 0x61; used.includes(fresh) || normalizeConditionText(fresh) !== fresh || fresh === '@' || fresh === '.' || /\s/.test(fresh); code++) fresh = String.fromCharCode(code)
  const tails = [...new Set([...preimages(tail), ...values.filter(test => test.operator === 'ends_with' && test.matched && test.value === tail).map(test => test.raw.trim().normalize('NFC'))])]
  let prefixes = ['']
  for (let length = 0; length <= 5; length++) {
    for (const prefix of prefixes) if (some(tails.map(suffix => prefix + suffix))) return true
    prefixes = prefixes.flatMap(prefix => [fresh, '@', '.'].map(character => prefix + character))
  }
  // No ASCII preimage can be shorter than its normalized text. Unusual Unicode
  // normalization at a boundary must refuse proof rather than invent reachability
  // or declare a potentially feasible destination impossible.
  if (/[^\x00-\x7f]/.test(tail)) return proof.refuse('Exact email suffix reachability exceeded its normalized witness domain. Simplify the condition before publishing.')
  return false
}
