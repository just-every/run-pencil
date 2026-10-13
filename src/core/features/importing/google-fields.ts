import { ValidationError } from '../../shared/errors'
import { object, stableId } from './fields'
import { forbiddenColumn, type GoogleQuestion, type ImportForm, type ImportStep, type QuestionType } from './model'
import { validateGoogleDefinition } from './google-validation'
import { googleLogic, type GoogleSection, type GoogleNavigation } from './google-logic'
export { googleIdentity } from './model'
export const googleOmission = (title: string) => /(?:^(?:score|total score|quiz score|feedback|correct answers?|answer key)(?:\b|\s*\[)|\[(?:score|feedback|correct answers?|answer key)\]$)/i.test(title.trim()) || /(?:file upload|uploaded files?)/i.test(title)
export function googleStep(scope: string, sourceId: string, title: string, type: QuestionType = 'short_text', selected?: GoogleQuestion): ImportStep {
  const step: ImportStep = { id: stableId(scope,JSON.stringify(['question',sourceId])), sourceId, sourceType: 'Google question', kind:'question', questionType: selected?.type ?? type, prompt:title, helperText:null, required:false, settings:{}, choices:[], next:null }
  if (selected) {
    if (!['short_text','long_text','email','single_choice','multiple_choice','dropdown','rating','yes_no','date','number','nps'].includes(selected.type)) throw new ValidationError('Unsupported Google question conversion.')
    const choiceType=['single_choice','multiple_choice','dropdown'].includes(selected.type)
    if(selected.choices && !choiceType) throw new ValidationError('Only choice questions accept option lists.')
    if((selected.min!==undefined||selected.max!==undefined)&&!['rating','number'].includes(selected.type)) throw new ValidationError('Numeric bounds require a rating or number question.')
    step.choices = (selected.choices ?? []).map((label,i) => ({ id:stableId(scope,`${sourceId}:choice:${i}`), sourceId:String(i), label }))
    if (selected.type === 'rating') { step.settings.min=selected.min; step.settings.max=selected.max }
    if (selected.type === 'number') { if(selected.min!==undefined) step.settings.min=selected.min; if(selected.max!==undefined) step.settings.max=selected.max }
    if (selected.type === 'multiple_choice') { step.settings.minSelections=0; step.settings.maxSelections=step.choices.length }
    if (selected.type === 'yes_no') {
      if (selected.confirmYesNo !== true || !selected.yesLabel || !selected.noLabel || selected.yesLabel === selected.noLabel) throw new ValidationError('Confirm true two-option Yes/No semantics and provide distinct exact Yes and No labels.')
      step.settings.importYesLabel=selected.yesLabel; step.settings.importNoLabel=selected.noLabel
    }
  }
  return step
}
export function mapGoogleFields(definition: Record<string, any>, scope: string, overrides: GoogleQuestion[]) {
  validateGoogleDefinition(definition)
  if (typeof definition.info?.title !== 'string' || !definition.info.title.trim() || !Array.isArray(definition.items)) throw new ValidationError('Google definition must be a forms.get object with info.title and items.')
  const form: ImportForm = { title: definition.info.title, steps:[],rules:[],report:[] }, forbidden = new Set<string>(), hardNames = new Set<string>(), gridNames = new Set<string>(), identities = new Set<string>(), used = new Set<string>()
  const sections: GoogleSection[] = [{id:'initial', title:'', entries:[]}], navigation: GoogleNavigation[] = []
  const report = (location:string,label:string,sourceType:string,state:'imported'|'changed'|'unsupported',change:string,reason:string) => form.report.push({location,label,sourceType,state,change,reason})
  for (const [index, raw] of definition.items.entries()) {
    const item=object(raw), location=`/items/${index}`, kinds=['questionItem','questionGroupItem','pageBreakItem','textItem','imageItem','videoItem'].filter(k=>item[k]!==undefined)
    if (typeof item.itemId !== 'string' || !item.itemId || identities.has(item.itemId) || kinds.length !== 1) throw new ValidationError('Google items require unique itemId values and exactly one supported item kind; no identity is guessed.')
    identities.add(item.itemId)
    const title = typeof item.title === 'string' ? item.title : '', section = sections[sections.length-1], kind=kinds[0]
    if (kind === 'pageBreakItem') { sections.push({id:item.itemId,title,entries:[]}); report(location,title || 'Section','section','changed','Section title attached to questions','Native questions remain ordered individual screens; section titles appear in helper text.'); continue }
    if (kind !== 'questionItem') {
      section.entries.push(null)
      if (kind === 'questionGroupItem') for (const [rowIndex, question] of (item.questionGroupItem.questions ?? []).entries()) { const row=object(question); const rowTitle=`${title} [${object(row.rowQuestion).title ?? ''}]`; gridNames.add(rowTitle); report(`${location}/questionGroupItem/questions/${rowIndex}`,rowTitle,'grid row','unsupported','Skipped unless explicitly mapped to an ordinary question','Native grids are not inferred. Create or map each row separately; its former layout and validation are lost.') }
      report(location,title || kind,kind,'unsupported','Item omitted; affected path needs repair','No faithful native representation. Images, videos, grids and display-only items are not silently removed from the navigation path.'); continue
    }
    const q=object(item.questionItem.question), id=q.questionId, qKinds=['textQuestion','choiceQuestion','scaleQuestion','dateQuestion','timeQuestion','fileUploadQuestion','rowQuestion','ratingQuestion'].filter(k=>q[k]!==undefined)
    if (typeof id!=='string' || !id || used.has(id) || qKinds.length!==1) throw new ValidationError('Google questions require unique questionId values and exactly one question kind.')
    used.add(id)
    const qKind=qKinds[0], privateField=forbiddenColumn(id)||forbiddenColumn(title)
    if (privateField) { forbidden.add(id.toLowerCase()); forbidden.add(title.toLowerCase()); section.entries.push(null); report(location,'Private source field',qKind,'unsupported','Field and answers omitted','Hidden and network/IP source identities cannot be imported.'); continue }
    if (qKind==='fileUploadQuestion') { hardNames.add(title); hardNames.add(id) }
    const selected=overrides.find(s=>s.sourceId===id)
    let type:QuestionType|undefined
    if (qKind==='textQuestion') type=q.textQuestion.paragraph===true?'long_text':'short_text'
    if (qKind==='choiceQuestion') type=({RADIO:'single_choice',CHECKBOX:'multiple_choice',DROP_DOWN:'dropdown'} as Record<string,QuestionType>)[q.choiceQuestion.type]
    if (qKind==='scaleQuestion'||qKind==='ratingQuestion') type='rating'
    if (qKind==='dateQuestion'&&q.dateQuestion.includeYear===true&&q.dateQuestion.includeTime!==true) type='date'
    if (!type) { section.entries.push(null); report(location,title,qKind,'unsupported','Question omitted; affected path needs repair','Files, grids, time/duration, incomplete dates and unknown choice kinds have no faithful mapping.'); continue }
    if (selected && !(['textQuestion'].includes(qKind) && ['short_text','long_text','email'].includes(selected.type)) && !(qKind==='choiceQuestion'&&q.choiceQuestion.type!=='CHECKBOX'&&selected.type==='yes_no')) throw new ValidationError('Definition overrides support explicit email/text conversion or confirmed two-option Yes/No only.')
    const step=googleStep(scope,id,title,type,selected)
    step.sourceType=qKind; step.required=q.required===true
    step.helperText=[section.title,typeof item.description==='string'?item.description:''].filter(Boolean).join('\n\n')||null
    if (qKind==='choiceQuestion') {
      if (!Array.isArray(q.choiceQuestion.options)) throw new ValidationError('Google choiceQuestion needs options.')
      const options=q.choiceQuestion.options
      if (selected?.type==='yes_no') {
        const labels=options.map((o:any)=>o.value)
        if (labels.length!==2 || !labels.includes(selected.yesLabel) || !labels.includes(selected.noLabel)) throw new ValidationError('Yes/No requires exactly the two original options, with explicit Yes and No meanings.')
      } else step.choices=options.map((o:any,i:number)=>({id:stableId(scope,`${id}:choice:${i}`),sourceId:String(i),label:typeof o.value==='string'?o.value:''}))
      if (type==='multiple_choice') { step.settings.minSelections=step.required?1:0; step.settings.maxSelections=step.choices.length }
      for (const [i,option] of options.entries()) {
        if (option.goToAction!==undefined || option.goToSectionId!==undefined) navigation.push({step,section:sections.length-1,option:i,value:option.value,action:option.goToAction,target:option.goToSectionId,location:`${location}/questionItem/question/choiceQuestion/options/${i}`})
        if (option.isOther || option.image) report(`${location}/questionItem/question/choiceQuestion/options/${i}`,title,'choice option','unsupported','Other input or option image omitted','Only fixed text options are represented; edit the question if an Other answer is needed.')
      }
      if(q.choiceQuestion.shuffle) report(`${location}/questionItem/question/choiceQuestion/shuffle`,title,qKind,'unsupported','Choice shuffle omitted','Choices retain their documented source order.')
    }
    if (qKind==='scaleQuestion') step.settings={min:q.scaleQuestion.low,max:q.scaleQuestion.high,...(q.scaleQuestion.lowLabel?{lowLabel:q.scaleQuestion.lowLabel}:{}),...(q.scaleQuestion.highLabel?{highLabel:q.scaleQuestion.highLabel}:{})}
    if (qKind==='ratingQuestion') { step.settings={min:1,max:q.ratingQuestion.ratingScaleLevel}; report(`${location}/questionItem/question/ratingQuestion/iconType`,title,qKind,'changed','Numeric rating','Source rating icons are not reproduced.') }
    form.steps.push(step); section.entries.push(step)
    report(location,title,qKind,selected?'changed':'imported',step.questionType!,'Prompt, required state and supported options are mapped; native answer limits apply.')
    const kindProperties:Record<string,string[]>={textQuestion:['paragraph'],choiceQuestion:['type','options','shuffle'],scaleQuestion:['low','high','lowLabel','highLabel'],dateQuestion:['includeTime','includeYear'],ratingQuestion:['ratingScaleLevel','iconType']}
    for(const key of Object.keys(q[qKind])) if(!(kindProperties[qKind]??[]).includes(key)) report(`${location}/questionItem/question/${qKind}/${key}`,title,'question property','unsupported','Validation or property omitted',`${key} is not reproduced; native validation applies.`)
    if(q.grading) report(`${location}/questionItem/question/grading`,title,'quiz grading','unsupported','Score, answer keys and feedback never imported','Quiz grading and feedback are discarded; the question remains an ordinary question.')
    if(item.questionItem.image) report(`${location}/questionItem/image`,title,'image','unsupported','Question image omitted','No source image bytes or URLs are retained.')
    for(const key of Object.keys(q)) if(!['questionId','required',qKind,'grading'].includes(key)) report(`${location}/questionItem/question/${key}`,title,'question property','unsupported','Property omitted',`${key} is not reproduced; native validation applies.`)
  }
  // Reject unknown overrides rather than silently accepting an unreviewed operator decision.
  for(const selected of overrides) if(!selected.sourceId.startsWith('csv:')&&!form.steps.some(s=>s.sourceId===selected.sourceId)) throw new ValidationError('Question conversion refers to an omitted or unknown Google question.')
  const completion:ImportStep={id:stableId(scope,'generated-completion'),sourceId:'generated-completion',sourceType:'generated',kind:'completion',questionType:null,prompt:'Thank you',helperText:null,required:false,settings:{},choices:[],next:null}
  form.steps.push(completion)
  report('/completion','Thank you','completion','changed','Native completion added','The Google confirmation message and response settings are not reproduced.')
  if(definition.settings?.emailCollectionType) report('/settings/emailCollectionType','Collected email','identity','unsupported','Identity defaults to Skip','Verified and Workspace identities are not authentication or contact data in Pencil. Explicit email-question mapping retains only an ordinary answer.')
  if(definition.settings?.quizSettings) report('/settings/quizSettings','Quiz settings','quiz','unsupported','Quiz behavior omitted','Scoring, correct answers and feedback are never imported.')
  for(const key of Object.keys(definition)) if(!['formId','info','items','settings','revisionId','responderUri','linkedSheetId'].includes(key)) report(`/${key}`,'Form property','Google setting','unsupported','Property omitted',`${key} is not reproduced.`)
  for(const key of ['formId','revisionId','responderUri','linkedSheetId']) if(definition[key]!==undefined) report(`/${key}`,'Source linkage','Google metadata','unsupported','Source linkage omitted','Google form, revision, response links and Sheet connections are not native links or synchronization. File hashes identify this imported artifact.')
  for(const key of Object.keys(definition.info)) if(key!=='title') report(`/info/${key}`,'Form information','Google info','unsupported','Property omitted',`${key} is not reproduced.`)
  for(const key of Object.keys(object(definition.settings))) if(!['emailCollectionType','quizSettings'].includes(key)) report(`/settings/${key}`,'Form setting','Google setting','unsupported','Property omitted',`${key} is not reproduced.`)
  googleLogic(form,sections,navigation,completion)
  return {form,forbidden,hardNames,gridNames}
}
