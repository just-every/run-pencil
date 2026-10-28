/** Mirrors matrixAnswerIssue at the SQL aggregation boundary, without loading responses. */
export function matrixValidity(raw = 'a.value_json', settings = "COALESCE(s.question_settings_json, '{}')", required = 's.required', step = 's') {
  const rows = `json_each(${settings}, '$.matrixRows')`
  const selected = `CASE WHEN m.type='array' THEN m.value ELSE json_array(m.value) END`
  return `json_type(${raw})='object'
    AND (SELECT COUNT(*) FROM json_each(${raw}))=(SELECT COUNT(DISTINCT key) FROM json_each(${raw}))
    AND NOT EXISTS (SELECT 1 FROM json_each(${raw}) m WHERE
      NOT EXISTS (SELECT 1 FROM ${rows} row WHERE json_extract(row.value,'$.id')=m.key)
      OR CASE WHEN json_extract(${settings},'$.matrixMode')='multiple' THEN
        m.type!='array' OR json_array_length(${selected})=0
        OR json_array_length(${selected})!=(SELECT COUNT(DISTINCT value) FROM json_each(${selected}))
      ELSE m.type!='text' END
      OR EXISTS (SELECT 1 FROM json_each(${selected}) picked WHERE picked.type!='text'
        OR NOT EXISTS (SELECT 1 FROM choice_options c WHERE c.step_id=${step}.id AND c.stable_id=picked.value)))
    AND (${required}=0 OR NOT EXISTS (SELECT 1 FROM ${rows} row WHERE NOT EXISTS
      (SELECT 1 FROM json_each(${raw}) m WHERE m.key=json_extract(row.value,'$.id'))))`
}
