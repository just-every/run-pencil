import manifest from '../../../../seed.json'
import { ValidationError } from '../../shared/errors'
import { hiddenSettingsIssue, hiddenValue, type HiddenField, type ResponseContext } from '../../shared/hiddenFields'
import { textSettingsIssue } from '../../shared/textValidation'
import { object, stableId } from './fields'
import { forbiddenColumn, type ColumnMapping, type ImportForm, type ImportInput, type ImportStep, type ReportItem } from './model'

const list = (value: unknown): any[] => Array.isArray(value) ? value : []
const plain = (value: unknown) => {
  const text=String(value ?? ''), output:string[]=[]
  for(let index=0;index<text.length;index++) {
    if(text[index]==='<' && /[A-Za-z/!]/.test(text[index+1] ?? '')) {
      const end=text.indexOf('>',index+2)
      if(end<0){output.push(text.slice(index));break}
      index=end;continue
    }
    output.push(text[index])
  }
  return output.join('').replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&quot;','"').replaceAll('&#39;',"'")
}

const cell = (value: unknown) => '"' + String(value ?? '').replaceAll('"', '""') + '"'
function invalid(message: string): never { throw new ValidationError(message + ' Nothing was written.') }

/** Uploaded GET /v3/surveys/{id}/details and /responses/bulk resources. No account connection or source request. */
export function surveyMonkeySource(input: ImportInput, survey: Record<string, any>, scope: string) {
  if (typeof survey.id !== 'string' || typeof survey.title !== 'string' || !survey.title.trim() || !Array.isArray(survey.pages)) invalid('SurveyMonkey details need an id, title and pages array.')
  let bulk: Record<string, any>
  try { bulk = object(JSON.parse(input.csv)) } catch { return invalid('SurveyMonkey responses-bulk JSON is not valid.') }
  if (!Array.isArray(bulk.data)) invalid('SurveyMonkey responses-bulk needs a data array, including an empty array for a structure-only import.')
  if(bulk.data.length>manifest.limits.responses.perRevision||survey.pages.reduce((count:number,page:any)=>count+list(object(page).questions).length,0)>manifest.limits.steps.perRevision)invalid('The uploaded survey exceeds the native step or response limit.')
  const form: ImportForm = {title:plain(survey.title),steps:[],rules:[],report:[]}
  const report = (location:string,label:string,sourceType:string,state:ReportItem['state'],change:string,reason:string) => form.report.push({location,label,sourceType,state,change,reason})
  const routingIncomplete = new Set<string>()
  const pages = new Set<string>(), seen = new Set<string>(), originalQuestions = new Map<string, any>()
  for (const [pageIndex, pageValue] of survey.pages.entries()) {
    const page = object(pageValue)
    if (typeof page.id !== 'string' || !Array.isArray(page.questions) || pages.has(page.id)) invalid('SurveyMonkey pages need distinct IDs and question arrays.')
    pages.add(page.id)
    report(`/pages/${pageIndex}`,plain(page.title ?? `Page ${pageIndex+1}`),'page','changed','Questions kept in source order','Separate classic pages are not reproduced.')
    for (const [index, value] of page.questions.entries()) {
      const question = object(value), location = `/pages/${pageIndex}/questions/${index}`
      if (typeof question.id !== 'string' || seen.has(question.id) || !Array.isArray(question.headings)) invalid('SurveyMonkey questions need distinct IDs and headings arrays.')
      seen.add(question.id); originalQuestions.set(question.id,question)
      const prompt = plain(question.headings[0]?.heading), family = String(question.family ?? ''), subtype = String(question.subtype ?? '')
      if (!prompt.trim()) invalid('SurveyMonkey questions need a nonempty heading.')
      if (forbiddenColumn(prompt) || forbiddenColumn(question.id)) {report(location,'Private source field',family,'unsupported','Not imported','Network and IP identities are not retained.');continue}
      const step: ImportStep = {id:stableId(scope,question.id),sourceId:question.id,sourceType:`${family}/${subtype}`,kind:'question',questionType:null,prompt,helperText:null,required:!!question.required,settings:{},choices:[],next:null}
      const answers = object(question.answers), choices = list(answers.choices), rows = list(answers.rows)
      if (family === 'presentation' && !form.steps.length) {step.kind='welcome';step.required=false}
      else if (family === 'open_ended' && ['single','essay'].includes(subtype)) {
        step.questionType=subtype==='essay'?'long_text':'short_text'
        const validation = object(question.validation)
        if (validation.type === 'email') step.questionType='email'
        else if (validation.type !== undefined && validation.type !== 'text_length') {report(`${location}/validation`,prompt,'validation','unsupported','Validation not imported','This source validation has no faithful text mapping.');continue}
        for (const [source,target] of [['min','minLength'],['max','maxLength'],['mask','inputMask'],['regex','pattern'],['text','validationMessage']] as const) if (validation[source] !== undefined) step.settings[target]=validation[source]
        const issue=textSettingsIssue(step.questionType,step.settings)
        if(issue) {report(`${location}/validation`,prompt,'validation','unsupported','Question not imported',issue);continue}
      } else if (['single_choice','multiple_choice'].includes(family)) {
        step.questionType=family==='multiple_choice'?'multiple_choice':subtype==='menu'?'dropdown':'single_choice'
        if (!choices.length) invalid('SurveyMonkey choice questions need choices.')
        const otherChoices=Array.isArray(answers.other) ? answers.other : answers.other && typeof answers.other==='object' ? [answers.other] : []
        const sourceChoices=[...choices,...otherChoices.filter(choice=>object(choice).is_answer_choice === true)]
        const choiceIds=new Set<string>()
        for(const [choiceIndex,choiceValue] of sourceChoices.entries()) {
          const choice=object(choiceValue)
          if(typeof choice.id!=='string'||choiceIds.has(choice.id)||typeof choice.text!=='string') invalid('SurveyMonkey choices need distinct IDs and text.')
          choiceIds.add(choice.id)
          const choiceLocation=choiceIndex<choices.length?`${location}/answers/choices/${choiceIndex}`:Array.isArray(answers.other)?`${location}/answers/other/${otherChoices.indexOf(choiceValue)}`:`${location}/answers/other`
          const id=stableId(scope,question.id+':'+choice.id)
          step.choices.push({id,sourceId:choice.id,label:plain(choice.text)})
          if(choice.is_answer_choice===true) { if(step.settings.otherChoiceId) invalid('Only one Other write-in can be mapped.');step.settings.otherChoiceId=id }
          for(const key of Object.keys(choice)) if(/logic|skip|branch|display|visible/i.test(key)) {routingIncomplete.add(step.id);report(`${choiceLocation}/${key}`,step.prompt,key,'unsupported','Not imported','Choice routing needs repair before publication.')}
          report(choiceLocation,plain(choice.text),'choice','imported',choice.is_answer_choice?'Other write-in':'Choice retained','Source choice identity is kept inside this import.')
        }
        if(step.questionType==='multiple_choice') {
          step.settings.minSelections=step.required?1:0;step.settings.maxSelections=step.choices.length
          const required=object(question.required),amount=Number(required.amount)
          if(required.type==='all')step.settings.minSelections=step.choices.length
          else if(required.type!==undefined) {
            if(!['at_least','at_most','exactly'].includes(required.type)||!Number.isInteger(amount)||amount<1||amount>step.choices.length) {report(`${location}/required`,prompt,'selection limit','unsupported','Question not imported','The source selection rule has no faithful bounded mapping.');for(const item of form.report)if(item.location.startsWith(location+'/')){item.state='unsupported';item.change='Not imported';item.reason='The parent question has an unsupported selection rule.'}continue}
            if(required.type!=='at_most')step.settings.minSelections=amount
            if(required.type!=='at_least')step.settings.maxSelections=amount
          }
        }
      } else if(family==='matrix' && subtype==='rating' && rows.length===1 && choices.length>=2 && choices.length<=11) {
        if(typeof object(rows[0]).id!=='string'||typeof object(rows[0]).text!=='string'||choices.some(choice=>typeof object(choice).id!=='string'||typeof object(choice).text!=='string')||new Set(choices.map(choice=>choice.id)).size!==choices.length)invalid('Scale rows and choices need distinct source IDs and text.')
        const weights=choices.map(choice=>choice.weight)
        if(!weights.every((weight,index)=>Number.isInteger(weight)&&weight===weights[0]+index)||![0,1].includes(weights[0])) {report(location,prompt,step.sourceType,'unsupported','Not imported','Scale weights must start at 0 or 1 and advance by one.');continue}
        step.questionType='rating';step.settings={min:weights[0],max:weights.at(-1),lowLabel:plain(choices[0].text),highLabel:plain(choices.at(-1).text)}
        if(choices.length%2===1) step.settings.middleLabel=plain(choices[Math.floor(choices.length/2)].text)
        step.helperText=plain(rows[0].text)||null
        report(`${location}/answers/rows/0`,step.helperText ?? prompt,'scale row','imported','Single row retained as question context','A one-row rating maps to a native opinion scale.')
        choices.forEach((choice,choiceIndex)=>{const supported=choiceIndex===0||choiceIndex===choices.length-1||choices.length%2===1&&choiceIndex===Math.floor(choices.length/2),numeric=plain(choice.text)===String(choice.weight);report(`${location}/answers/choices/${choiceIndex}`,plain(choice.text),'scale choice',supported||numeric?'imported':'changed',supported?'Scale label retained':numeric?'Numeric scale value retained':'Intermediate label not shown','Native scales retain low, middle and high labels; every source weight stays numeric.')})
      } else {
        report(location,prompt,step.sourceType,'unsupported','Not imported',family==='presentation'?'Descriptive text after the leading item awaits FIELD-011.':'Matrix, ranking and other unsupported question types await their field clauses.')
        continue
      }
      form.steps.push(step)
      report(location,prompt,step.sourceType,'imported',step.kind==='welcome'?'Leading text becomes a welcome screen':'Question retained','The uploaded files are data; no source account is contacted.')
      for(const key of ['skip_logic','display_logic','logic','advanced_branching']) if(question[key]!==undefined) report(`${location}/${key}`,prompt,key,'unsupported','Not imported','This file does not provide a supported, documented condition mapping. Repair routing before publication; no source condition is guessed.')
      for(const [headingIndex,heading] of question.headings.entries()) if(headingIndex>0) report(`${location}/headings/${headingIndex}`,plain(object(heading).heading),'heading','unsupported','Not imported','Additional question headings are not reproduced.')
    }
  }
  const hiddenFields:HiddenField[]=[], variableNames=new Map<string,HiddenField>()
  for(const [name,label] of Object.entries(object(survey.custom_variables))) {
    if(!/^[a-z][a-z0-9_]{0,63}$/.test(name)||forbiddenColumn(name)) {report('/custom_variables/'+name,'Unsupported custom variable','custom variable','unsupported','Not imported','A native parameter needs a safe lowercase name and cannot retain network identity.');continue}
    const identifying=/email|name|phone/i.test(name), field:HiddenField={id:stableId(scope,'hidden:'+name),name,type:/email/i.test(name)?'email':'text',category:identifying?'identifying':'plain'}
    hiddenFields.push(field);variableNames.set(name,field)
    report('/custom_variables/'+name,plain(label ?? name),'custom variable','imported','Declared as a hidden field','Only explicitly declared variables are retained as response context.')
  }
  if(hiddenFields.length) {form.settings={hiddenFields,identityMode:hiddenFields.some(field=>field.category==='identifying')?'identified':'anonymous'};const issue=hiddenSettingsIssue(form.settings);if(issue)invalid(issue)}
  const incomplete = new Set([...routingIncomplete,...form.steps.filter(step=>['skip_logic','display_logic','logic','advanced_branching'].some(key=>originalQuestions.get(step.sourceId)?.[key]!==undefined)).map(step=>step.id)])
  const complete:ImportStep={id:stableId(scope,'completion'),sourceId:'completion',sourceType:'generated',kind:'completion',questionType:null,prompt:'Thank you',helperText:null,required:false,settings:{},choices:[],next:null}
  form.steps.push(complete);form.steps.forEach((step,index)=>{step.next=incomplete.has(step.id) ? null : form.steps[index+1]?.id ?? null})
  const questions=form.steps.filter(step=>step.kind==='question'), headers=['Submission time',...questions.flatMap(step=>[step.prompt,...step.settings.otherChoiceId?[step.prompt+' — Other text']:[]])]
  const columns:ColumnMapping[]=[{column:0,target:'submittedAt'}]
  for(const step of questions) {columns.push({column:columns.length,target:step.id});if(step.settings.otherChoiceId)columns.push({column:columns.length,target:step.id,choice:String(step.settings.otherChoiceId)})}
  const contexts:ResponseContext[]=[], records:string[][]=[], responseIds=new Set<string>(), collectors=new Set<string>()
  for(const [index,responseValue] of bulk.data.entries()) {
    const response=object(responseValue)
    if(typeof response.id!=='string'||responseIds.has(response.id)||response.survey_id!==undefined&&response.survey_id!==survey.id||!Array.isArray(response.pages)) invalid('SurveyMonkey responses need distinct IDs, matching survey identity and page arrays.')
    responseIds.add(response.id)
    if(response.response_status!=='completed') {report(`/responses/${index}`,'Incomplete source response','response','unsupported','Not imported','Only completed responses are imported.');continue}
    if(typeof response.date_modified!=='string') invalid('Each completed response needs its original date_modified submission time.')
    const byQuestion=new Map<string,any[]>()
    for(const page of response.pages) for(const questionValue of list(object(page).questions)) {
      const q=object(questionValue)
      if(typeof q.id!=='string'||!Array.isArray(q.answers)||byQuestion.has(q.id)) invalid('Source response questions need distinct IDs and answer arrays.')
      byQuestion.set(q.id,q.answers)
      report(`/responses/${index}/questions/${q.id}`,'Source answer',originalQuestions.get(q.id)?.family ?? 'unknown',questions.some(step=>step.sourceId===q.id)?'imported':'unsupported',questions.some(step=>step.sourceId===q.id)?'Mapped to the reviewed question':'Not imported','Unmapped answer values are discarded.')
    }
    const values=[response.date_modified]
    for(const step of questions) {
      const source=originalQuestions.get(step.sourceId), sourceAnswers=(byQuestion.get(step.sourceId) ?? []).map(object)
      let value='', other=''
      if(step.questionType==='rating') {
        if(sourceAnswers.length>1||sourceAnswers.some(answer=>answer.row_id!==undefined&&answer.row_id!==source.answers.rows[0].id))invalid('A single-row scale response has multiple or unknown rows.')
        const selected=list(source.answers?.choices).find(choice=>choice.id===sourceAnswers[0]?.choice_id)
        if(sourceAnswers.length&&!selected)invalid('A scale answer names an unknown choice.')
        value=selected ? String(selected.weight) : ''
      } else if(step.choices.length) {
        const ids:string[]=[]
        for(const answer of sourceAnswers) {
          const choice=step.choices.find(choice=>choice.sourceId===answer.choice_id)
          if(!choice)invalid('An answer names an unknown source choice.')
          if(choice.id===step.settings.otherChoiceId) {if(typeof answer.text!=='string')invalid('An Other answer needs its write-in text.');other=answer.text}
          else ids.push(choice.sourceId)
        }
        if(step.questionType!=='multiple_choice'&&ids.length+(other?1:0)>1)invalid('A single-choice response contains multiple selections.')
        value=ids.length ? step.questionType==='multiple_choice'?JSON.stringify(ids):ids[0] : ''
      } else {
        if(sourceAnswers.length>1||sourceAnswers.some(answer=>typeof answer.text!=='string'))invalid('A text answer needs one text value.')
        value=sourceAnswers[0]?.text ?? ''
      }
      values.push(value);if(step.settings.otherChoiceId)values.push(other)
    }
    const hidden:ResponseContext['hidden']={}
    for(const [name,raw] of Object.entries(object(response.custom_variables))) {
      const field=variableNames.get(name)
      if(!field) {report(`/responses/${index}/custom_variables/${name}`,'Undeclared custom variable','custom variable','unsupported','Not imported','Only reviewed declarations are retained.');continue}
      const parsed=hiddenValue(field,raw)
      if(parsed===undefined)invalid('A custom variable does not fit its declared hidden field.')
      hidden[field.id]=parsed
    }
    contexts.push({hidden,discarded:0,identityMode:form.settings?.identityMode ?? 'anonymous'});records.push(values)
    if(typeof response.collector_id==='string')collectors.add(response.collector_id)
    report(`/responses/${index}`,'Completed source response','response','imported','Historical completion','The response retains its source submission time and sends no notification.')
  }
  for(const id of collectors) report('/collectors/'+id,'Source collector '+id,'collector','unsupported','Not imported','Source collector attribution is not mapped; imported responses use Pencil’s existing Imported responses collector. No channel is guessed.')
  for(const key of ['logic','advanced_branching','skip_logic','display_logic']) if(survey[key]!==undefined) {const first=form.steps.find(step=>step.kind==='question');if(first)first.next=null;report('/'+key,'Survey routing',key,'unsupported','Not imported','No faithful condition mapping is available for this source object.')}
  if(bulk.total!==undefined&&bulk.total!==bulk.data.length)report('/responses/total','Response pagination','pagination','unsupported','Only uploaded rows imported','The file does not contain every source response; no next page is fetched.')
  for(const key of Object.keys(survey)) if(!['id','title','pages','custom_variables','logic','advanced_branching','skip_logic','display_logic'].includes(key)) report('/'+key,key,'survey property','unsupported','Not imported','Account metadata and unrelated survey properties are not reproduced.')
  const csv=[headers,...records].map(row=>row.map(cell).join(',')).join('\n')
  if(new TextEncoder().encode(csv).byteLength>8*1024*1024)invalid('Normalized answers exceed the 8 MiB limit.')
  return {form,csv,columns,contexts}
}
