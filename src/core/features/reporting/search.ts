import { choiceIdsSql } from '../../shared/otherChoices'
/** Search answers, choice labels, invitation identity and declared hidden values.
 * The enclosing response scope owns workspace, state and cutoff restrictions.
 * instr treats %, _ and SQL punctuation as literal text.
 */
export function responseSearch(search: string) {
  const contains = (value: string) => `instr(lower(${value}), lower(?)) > 0`
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
    ))`,
    bindings: Array(5).fill(search) as string[],
  }
}
