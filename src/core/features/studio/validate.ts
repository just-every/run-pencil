import { ulid } from 'ulid'
import { ValidationError } from '../../shared/errors'
import { validateRevisionGraph } from '../flows'
import type { StoredBranchRule,StoredChoice,StoredStep } from '../flows'
import { outputSchema, type StudioInput } from './model'
import { biasFlags, sampleSize } from './checks'

export function validateStudio(raw:unknown,input:StudioInput,revisionId:string,now:string) {
  const parsed=outputSchema.safeParse(raw)
  if(!parsed.success)throw new ValidationError('The provider returned an invalid form schema. No draft was created.')
  const output=parsed.data
  if(input.mode==='study'&&!output.study||input.mode==='form'&&output.study)throw new ValidationError('The provider did not return the requested form or study. No draft was created.')
  const byKey=new Map(output.steps.map(step=>[step.key,step]))
  if(byKey.size!==output.steps.length)throw new ValidationError('Generated step keys must be unique.')
  const stable=new Map(output.steps.map(step=>[step.key,ulid()])), rowIds=new Map(output.steps.map(step=>[step.key,ulid()]))
  const choices:StoredChoice[]=[],steps:StoredStep[]=output.steps.map((step,position)=>{
    if(step.next&&!byKey.has(step.next))throw new ValidationError('A generated path has a missing destination.')
    if(step.kind==='completion'&&(step.questionType!==null||step.required||step.choices.length||step.scale||step.next)||step.kind==='question'&&!step.questionType)throw new ValidationError('Generated question and completion fields do not match their kind.')
    if(new Set(step.choices.map(label=>label.toLowerCase())).size!==step.choices.length)throw new ValidationError('Generated choice labels must be distinct.')
    const choiceType=step.questionType==='single_choice'||step.questionType==='multiple_choice'
    if(choiceType&&step.choices.length<2||!choiceType&&step.choices.length||step.questionType==='rating'&&!step.scale||step.questionType!=='rating'&&step.scale)throw new ValidationError('Generated choices or scale settings do not match the question type.')
    const settings=step.questionType==='rating'?step.scale:step.questionType==='multiple_choice'?{minSelections:0,maxSelections:step.choices.length}:null
    for(const [index,label] of step.choices.entries())choices.push({id:ulid(),stableId:ulid(),stepId:rowIds.get(step.key)!,value:String(index),label,position:index,createdAt:now,updatedAt:now})
    return {id:rowIds.get(step.key)!,stableId:stable.get(step.key)!,revisionId,position,kind:step.kind,questionType:step.questionType,prompt:step.prompt,helperText:null,required:step.required,nextStepStableId:step.next?stable.get(step.next)!:null,questionSettingsJson:settings?JSON.stringify(settings):null,createdAt:now,updatedAt:now}
  })
  if(steps[0].kind!=='question'||steps.at(-1)?.kind!=='completion'||steps.filter(step=>step.kind==='completion').length!==1)throw new ValidationError('A generated form needs questions followed by one completion.')
  const rules:StoredBranchRule[]=output.branches.map((branch,position)=>{
    const source=byKey.get(branch.source),destination=stable.get(branch.destination)
    if(!source||!destination)throw new ValidationError('A generated branch has a missing source or destination.')
    let expected:unknown
    if(source.questionType==='single_choice') {
      if(branch.predicate!=='equals'||branch.choiceIndex===null||branch.numberValue!==null||branch.booleanValue!==null)throw new ValidationError('A choice branch must select one known choice.')
      expected=choices.filter(choice=>choice.stepId===rowIds.get(source.key))[branch.choiceIndex]?.stableId
    } else if(['number','rating','nps'].includes(source.questionType ?? '')) {
      if(branch.numberValue===null||branch.choiceIndex!==null||branch.booleanValue!==null)throw new ValidationError('A score branch needs one numeric comparison.')
      expected=branch.numberValue
    } else if(source.questionType==='yes_no') {
      if(branch.predicate!=='equals'||branch.booleanValue===null||branch.choiceIndex!==null||branch.numberValue!==null)throw new ValidationError('A Yes/No branch needs one Boolean answer.')
      expected=branch.booleanValue
    }
    if(expected===undefined)throw new ValidationError('This generated branch has no supported, faithful operand.')
    return {id:ulid(),revisionId,sourceStepStableId:stable.get(source.key)!,destinationStepStableId:destination,predicateKind:branch.predicate,expectedValueJson:JSON.stringify(expected),position,createdAt:now,updatedAt:now}
  })
  const issues=validateRevisionGraph(steps,choices,rules)
  if(issues.length)throw new ValidationError(`The generated form has an invalid path: ${issues[0].reason} No draft was created.`)
  const flags=output.steps.filter(step=>step.kind==='question').flatMap(step=>biasFlags(stable.get(step.key)!,step.prompt,step.choices))
  for(const flag of output.flags) {
    if(!stable.has(flag.step)||byKey.get(flag.step)?.kind!=='question')throw new ValidationError('A provider advisory names a missing question.')
    flags.push({stepId:stable.get(flag.step)!,kind:flag.kind,reason:flag.reason,source:'provider'})
  }
  return {title:output.title,steps,choices,rules,metadata:{generatedStepIds:steps.map(step=>step.stableId),study:output.study,sample:input.mode==='study'?{population:input.population,margin:input.margin,confidence:95 as const,size:sampleSize(input.population,input.margin)}:null,advisories:flags.filter(flag=>flag.source==='provider')},flags}
}
