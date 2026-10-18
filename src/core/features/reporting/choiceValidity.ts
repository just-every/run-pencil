import manifest from '../../../../seed.json' with { type: 'json' }
import { choiceIdsSql } from '../../shared/otherChoices'
import { sqlTextWithin } from './textValidity'

/** Retained choice values must still match their immutable revision. */
export function choiceValidity(multiple: boolean) {
  const raw = 'a.value_json', ids = choiceIdsSql(raw), settings = "COALESCE(s.question_settings_json,'{}')"
  const other = `json_extract(${settings},'$.otherChoiceId')`, none = `json_extract(${settings},'$.noneChoiceId')`
  const has = (id: string) => `EXISTS(SELECT 1 FROM json_each(${ids}) j WHERE j.value=${id})`
  const count = `(SELECT COUNT(*) FROM json_each(${ids}))`
  return `json_type(${raw}) IN (${multiple ? "'array','object'" : "'text','object'"})
    AND (json_type(${raw})!='object' OR (json_type(${raw},'$.choiceIds')='array' AND (SELECT COUNT(*) FROM json_each(${raw}))=2))
    AND NOT EXISTS(SELECT 1 FROM json_each(${ids}) j WHERE j.type!='text' OR NOT EXISTS(SELECT 1 FROM choice_options c WHERE c.step_id=s.id AND c.stable_id=j.value))
    AND ${count}=(SELECT COUNT(DISTINCT value) FROM json_each(${ids}))
    AND (${has(none)} AND ${count}=1 OR NOT ${has(none)} AND ${count} ${multiple ? `BETWEEN COALESCE(json_extract(${settings},'$.minSelections'),1) AND COALESCE(json_extract(${settings},'$.maxSelections'),(SELECT COUNT(*) FROM choice_options c WHERE c.step_id=s.id))` : '=1'})
    AND ((${has(other)} AND json_type(${raw})='object' AND json_type(${raw},'$.otherText')='text' AND length(trim(json_extract(${raw},'$.otherText')))>0 AND ${sqlTextWithin(`json_extract(${raw},'$.otherText')`,manifest.limits.responses.shortTextCharactersPerAnswer)})
      OR (NOT ${has(other)} AND json_type(${raw})!='object'))`
}
