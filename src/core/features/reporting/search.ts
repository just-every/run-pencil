import { z } from 'zod'
import { choiceIdsSql } from '../../shared/otherChoices'
const sigma = ['Σ', 'σ', 'ς']
const ascii = (char: string) => char.charCodeAt(0) < 128
const single = (value: string) => [...value].length === 1

/** Case-insensitive matching for the NFC phrase. SQLite lower() folds only
 * ASCII, so each other letter of the phrase is folded in the haystack by
 * replace() from its single-code-point case forms (É to é, Ж to ж, Σ and ς to
 * σ); the phrase is folded the same way. instr treats %, _, * and SQL
 * punctuation as literal text, and the replacements are letters only.
 */
export function searchFold(search: string) {
  const canonical = (char: string) => sigma.includes(char) ? 'σ' : single(char.toLowerCase()) ? char.toLowerCase() : char
  const phrase = [...search.normalize('NFC')].map(char => ascii(char) ? char.toLowerCase() : canonical(char)).join('')
  const replacements = new Map<string, string>()
  for (const char of new Set(phrase)) {
    if (ascii(char)) continue
    for (const form of [char.toUpperCase(), ...(char === 'σ' ? sigma : [])]) if (form !== char && single(form)) replacements.set(form, char)
  }
  const quote = (value: string) => `'${value.replaceAll("'", "''")}'`
  return { phrase, letters: replacements.size, fold: (value: string) => [...replacements].reduce((sql, [from, to]) => `replace(${sql}, ${quote(from)}, ${quote(to)})`, `lower(${value})`) }
}

/** D1 caps an expression tree at depth 100, each folded letter nests one
 * replace() and the response scope already uses about 60 levels. */
export const searchFoldedLetterLimit = 32
export const searchPhrase = z.string().trim().max(200).refine(value => searchFold(value).letters <= searchFoldedLetterLimit, {
  message: `Search for at most ${searchFoldedLetterLimit} different accented or non-Latin letters at once.`,
})

/** Search answers, choice labels, invitation identity, hidden values and calculated text.
 * The enclosing response scope owns workspace, state and cutoff restrictions.
 */
export function responseSearch(search: string) {
  const { phrase, fold } = searchFold(search)
  const contains = (value: string) => `instr(${fold(value)}, ?) > 0`
  return {
    sql: `(EXISTS (
      SELECT 1 FROM response_answers sa
      JOIN flow_steps ss ON ss.revision_id=r.revision_id AND ss.stable_id=sa.step_id
      JOIN json_tree(sa.value_json) leaf
      WHERE sa.response_id=r.id AND leaf.type='text'
        AND (ss.question_type NOT IN ('single_choice','multiple_choice','dropdown','priority') OR leaf.key='otherText')
        AND ${contains('leaf.value')}
    ) OR EXISTS (
      SELECT 1 FROM response_answers sa
      JOIN flow_steps ss ON ss.revision_id=r.revision_id AND ss.stable_id=sa.step_id
      JOIN json_each(${choiceIdsSql('sa.value_json')}) selected
      JOIN choice_options choice ON choice.step_id=ss.id AND choice.stable_id=selected.value
      WHERE sa.response_id=r.id AND ss.question_type IN ('single_choice','multiple_choice','dropdown','priority')
        AND ${contains('choice.label')}
    ) OR EXISTS (
      SELECT 1 FROM invitation_participants person
      WHERE person.id=r.participant_id AND person.workspace_id=r.workspace_id
        AND (${contains('person.name_snapshot')} OR ${contains('person.email_snapshot')})
    ) OR EXISTS (
      SELECT 1 FROM json_each(r.response_context_json, '$.hidden') hidden
      JOIN flow_revisions hidden_revision ON hidden_revision.id=r.revision_id AND hidden_revision.flow_id=r.flow_id
      JOIN json_each(hidden_revision.form_settings_json, '$.hiddenFields') declared ON json_extract(declared.value, '$.id')=hidden.key
      WHERE hidden.type IN ('text','integer','real','true','false')
        AND ${contains("CASE hidden.type WHEN 'true' THEN 'true' WHEN 'false' THEN 'false' ELSE CAST(hidden.value AS TEXT) END")}
    ) OR EXISTS (
      SELECT 1 FROM json_each(r.response_context_json, '$.calculations') calculated
      JOIN flow_revisions calculated_revision ON calculated_revision.id=r.revision_id AND calculated_revision.flow_id=r.flow_id
      JOIN json_each(calculated_revision.form_settings_json, '$.calculations') declared ON json_extract(declared.value, '$.id')=calculated.key
      WHERE calculated.type='text' AND json_extract(declared.value, '$.type')='text'
        AND ${contains('calculated.value')}
    ))`,
    bindings: Array(6).fill(phrase) as string[],
  }
}
