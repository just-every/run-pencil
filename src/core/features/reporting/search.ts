/** Search answer values, published choice labels and retained invitation identity.
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
        AND ss.question_type NOT IN ('single_choice','multiple_choice','dropdown','priority')
        AND ${contains('leaf.value')}
    ) OR EXISTS (
      SELECT 1 FROM response_answers sa
      JOIN flow_steps ss ON ss.revision_id=r.revision_id AND ss.stable_id=sa.step_id
      JOIN json_each(sa.value_json) selected
      JOIN choice_options choice ON choice.step_id=ss.id AND choice.stable_id=selected.value
      WHERE sa.response_id=r.id AND ss.question_type IN ('single_choice','multiple_choice','dropdown','priority')
        AND ${contains('choice.label')}
    ) OR EXISTS (
      SELECT 1 FROM invitation_participants person
      WHERE person.id=r.participant_id AND person.workspace_id=r.workspace_id
        AND (${contains('person.name_snapshot')} OR ${contains('person.email_snapshot')})
    ))`,
    bindings: Array(4).fill(search) as string[],
  }
}
