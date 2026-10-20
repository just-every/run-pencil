import { z } from 'zod'
import { foldSearch } from '../../shared/searchFold'

export const searchPhrase = z.string().trim().max(200)

/** Materialize matching response IDs once per count/page, rather than running
 * correlated answer/JSON/choice scans for each candidate response. Each value
 * is a separate retained answer leaf, choice label, declared context value or
 * invitation identity snapshot, folded to NFC at write time by migration 0053.
 * The enclosing scope retains workspace, release, erasure and cutoff rules.
 */
export function responseSearch(search: string) {
  return {
    sql: 'r.id IN (SELECT response_id FROM response_search_values WHERE instr(value, ?) > 0)',
    bindings: [foldSearch(search)],
  }
}
