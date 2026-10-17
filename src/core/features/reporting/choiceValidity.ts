import { sqlTextWhitespace } from './choiceTextValidity'
import manifest from '../../../../seed.json'
import { sqlTextWithin } from './textValidity'

/** Shared SQL projection for count/filter queries. Malformed objects stay invalid. */
export function sqlChoiceSelection(json = 'a.value_json') {
  return `CASE WHEN json_type(${json}) = 'object' THEN CASE WHEN json_type(${json}, '$.choiceIds') = 'array' THEN json_extract(${json}, '$.choiceIds') ELSE '[]' END ELSE ${json} END`
}

/** Canonical FIELD010 shapes, referential integrity, cardinality and seed text bound.
 * FIELD013 operator constraints compile from the shared parser alongside aggregation.
 */
export function sqlChoiceAnswerValid(json = 'a.value_json') {
  const kind = `json_type(${json})`, selected = sqlChoiceSelection(json)
  const settings = "COALESCE(s.question_settings_json,'{}')"
  const otherId = `json_extract(${settings},'$.otherChoiceId')`, noneId = `json_extract(${settings},'$.noneChoiceId')`
  const text = `json_extract(${json},'$.other.text')`
  const selectedOther = `EXISTS(SELECT 1 FROM json_each(${selected}) j WHERE j.type='text' AND j.value=${otherId})`
  const selectedNone = `EXISTS(SELECT 1 FROM json_each(${selected}) j WHERE j.type='text' AND j.value=${noneId})`
  const count = `CASE WHEN ${kind}='text' THEN 1 ELSE json_array_length(${selected}) END`
  const optionsValid = `NOT EXISTS(SELECT 1 FROM json_each(${selected}) j WHERE j.type!='text' OR NOT EXISTS(SELECT 1 FROM choice_options c WHERE c.step_id=s.id AND c.stable_id=j.value))
    AND (${count})=(SELECT COUNT(DISTINCT j.value) FROM json_each(${selected}) j)`
  const whitespace = sqlTextWhitespace
  const shape = `((${kind}='text' AND s.question_type IN ('single_choice','dropdown') AND NOT (${selectedOther}))
    OR (${kind}='array' AND s.question_type='multiple_choice' AND NOT (${selectedOther}))
    OR (${kind}='object' AND json_type(${json},'$.choiceIds')='array' AND json_type(${json},'$.other')='object'
      AND (SELECT COUNT(*) FROM json_each(${json}))=2 AND (SELECT COUNT(*) FROM json_each(${json},'$.other'))=2
      AND json_type(${json},'$.other.choiceId')='text' AND json_extract(${json},'$.other.choiceId')=${otherId} AND (${selectedOther})
      AND json_type(${json},'$.other.text')='text' AND length(CAST(trim(${text},char(${whitespace})) AS BLOB))>0
      AND ${sqlTextWithin(text, manifest.limits.responses.shortTextCharactersPerAnswer)}))`
  return `${shape} AND ${optionsValid} AND (${count})>=1
    AND (s.question_type='multiple_choice' OR (${count})=1)
    AND (NOT (${selectedNone}) OR (${count})=1)
    AND (s.question_type!='multiple_choice' OR (((${count})>=COALESCE(json_extract(${settings},'$.minSelections'),1) OR (${selectedNone}))
      AND (${count})<=COALESCE(json_extract(${settings},'$.maxSelections'),(SELECT COUNT(*) FROM choice_options c WHERE c.step_id=s.id))))`
}
