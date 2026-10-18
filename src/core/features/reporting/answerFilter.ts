import { choiceIdsSql } from '../../shared/otherChoices'
import { calendarDate } from '../../shared/questionTypes'

/** Compare against the stored JSON type, without SQLite's text/number coercion. */
export function structuredAnswerFilter(stepId: string, value: string) {
  const clauses = [
    "(s.question_type = 'email' AND json_type(a.value_json) = 'text' AND lower(json_extract(a.value_json, '$')) = lower(?))",
    `(s.question_type IN ('multiple_choice','priority','single_choice','dropdown') AND EXISTS (SELECT 1 FROM json_each(${choiceIdsSql('a.value_json')}) WHERE type='text' AND value=?))`,
    "(s.question_type IN ('short_text', 'long_text') AND json_type(a.value_json) = 'text' AND json_extract(a.value_json, '$') = ?)",
  ]
  const bindings: Array<string | number> = [stepId, value, value, value]
  if (value === 'true' || value === 'false') {
    clauses.push("(s.question_type IN ('yes_no', 'thumbs_rating') AND json_type(a.value_json) = ?)")
    clauses.push("(s.question_type = 'consent' AND json_type(a.value_json, '$.accepted') = ?)")
    bindings.push(value, value)
  }
  // A full finite decimal is required: empty, hex, Infinity and numeric prefixes
  // must never turn into a numeric match through CAST or Number coercion.
  if (value === value.trim() && /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value) && Number.isFinite(Number(value))) {
    clauses.push("(s.question_type IN ('rating', 'nps', 'number', 'csat', 'ces', 'emoji_rating') AND json_type(a.value_json) IN ('integer', 'real') AND json_extract(a.value_json, '$') = ?)")
    bindings.push(Number(value))
  }
  if (calendarDate(value)) {
    clauses.push("(s.question_type = 'date' AND json_type(a.value_json) = 'text' AND json_extract(a.value_json, '$') = ?)")
    bindings.push(value)
  }
  return {
    sql: `EXISTS (SELECT 1 FROM response_answers a JOIN flow_steps s ON s.revision_id = r.revision_id AND s.stable_id = a.step_id
      WHERE a.response_id = r.id AND a.step_id = ? AND (${clauses.join(' OR ')}))`,
    bindings,
  }
}
