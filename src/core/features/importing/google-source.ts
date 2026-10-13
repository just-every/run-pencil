import manifest from '../../../../seed.json'
import { ValidationError } from '../../shared/errors'
import { csvRows } from './csv'
import { googleIdentity, googleOmission, googleStep, mapGoogleFields } from './google-fields'
import { stableId } from './fields'
import { forbiddenColumn, type ColumnMapping, type GoogleReview, type ImportForm, type ImportInput } from './model'
export function googleSource(input:ImportInput,definition:Record<string,any>,scope:string) {
  const settings=input.google??{}, overrides=settings.questions??[]
  const headers:string[]=csvRows(input.csv).next().value?.cells??[]
  if(new Set(overrides.map(s=>s.sourceId)).size!==overrides.length) throw new ValidationError('Choose each question type once.')
  const parsed=input.definition.trim()?mapGoogleFields(definition,scope,overrides):undefined
  const form:ImportForm=parsed?.form??{title:settings.title?.trim()||'Imported Google form',steps:[],rules:[],report:[]}
  const forbidden=parsed?.forbidden??new Set<string>(), hardNames=parsed?.hardNames??new Set<string>(), gridNames=parsed?.gridNames??new Set<string>()
  const hardColumns=new Set<number>(), hardReasons=new Map<number,string>(), counts=headers.map(()=>0), observations=headers.map(()=>new Set<string>()), onlyDriveFiles=headers.map(()=>true)
  const grid=(header:string)=>gridNames.has(header)||/\s\[[^\]]+\]$/.test(header)
  const metadata=(header:string)=>googleIdentity(header)||googleOmission(header)||grid(header)||/^timestamp$/i.test(header)||forbiddenColumn(header)||forbidden.has(header.toLowerCase())||hardNames.has(header)
  for(const [i,header] of headers.entries()) if(googleOmission(header)||hardNames.has(header)||forbiddenColumn(header)||forbidden.has(header.toLowerCase())) { hardColumns.add(i); hardReasons.set(i, hardNames.has(header)||/(?:file upload|uploaded files?)/i.test(header) ? 'File-upload answers and Drive links are never imported.' : googleOmission(header) ? 'Quiz Score, correct answers and feedback are never imported.' : 'Hidden and network/IP metadata is never imported.') }
  for(const row of csvRows(input.csv)) {
    if(row.row===1) continue
    if(row.row-1>manifest.limits.responses.perRevision) throw new ValidationError('CSV exceeds the configured responses-per-revision limit. Nothing was written.')
    for(let i=0;i<headers.length;i++) {
      const value=row.cells[i]??''
      if(value!=='') counts[i]++
      const driveFile=value!==''&&driveFileCell(value)
      if(value!==''&&!driveFile) onlyDriveFiles[i]=false
      if(!value||driveFile||hardColumns.has(i)|| (metadata(headers[i]) && !(grid(headers[i]) && overrides.some(q=>q.sourceId===`csv:${i}`)))) continue
      // A bounded observation list is a suggestion, never an inferred schema.
      if(value.length<=300&&observations[i].size<manifest.limits.steps.choiceOptionsPerStep) observations[i].add(value)
    }
  }
  // Without a definition, a column holding nothing but Drive file links looks like a file upload. It starts skipped, and the
  // operator may still choose a question type for it. With a definition, only its declared file questions are file uploads.
  const driveColumns=new Set(headers.flatMap((_,i)=>!parsed&&counts[i]>0&&onlyDriveFiles[i]&&!hardColumns.has(i)?[i]:[]))
  const skipReasons=new Map([...driveColumns].map(i=>[i,'Every answer is a Google Drive file link. File uploads are skipped unless you choose a question type for this column.']))
  const review:GoogleReview={mode:parsed?'definition':'csv-only',proposals:[]}
  for(const [column,title] of headers.entries()) {
    if(hardColumns.has(column)) continue
    const sourceId=`csv:${column}`, selected=overrides.find(q=>q.sourceId===sourceId), isMetadata=metadata(title)
    if(/^timestamp$/i.test(title)) { if(selected) throw new ValidationError('Timestamp columns cannot become answer questions.'); continue }
    const observedChoices=[...observations[column]]
    if(!parsed||googleIdentity(title)||grid(title)) review.proposals.push({sourceId,column,title,observedChoices,...(driveColumns.has(column)?{driveFiles:true}:{}),...(observedChoices.length>1?{suggestedType:observedChoices.every(v=>/^(?:0|[1-9]\d*)$/.test(v)) && Math.max(...observedChoices.map(Number))-Math.min(...observedChoices.map(Number))<=10?'rating':'single_choice'}:{})})
    if(parsed&&!selected) continue
    if((isMetadata||driveColumns.has(column))&&!selected) continue
    if(googleIdentity(title)&&selected?.type!=='email') throw new ValidationError('Collected identity may only map to an explicitly selected ordinary email question.')
    const step=googleStep(scope,sourceId,title,'short_text',selected)
    if(selected?.choices?.some(label=>!observations[column].has(label))) throw new ValidationError('CSV-only options must be observed whole labels; the export cannot establish unseen options or split checkbox labels.')
    if(selected?.type==='yes_no'&&!parsed&&(observations[column].size!==2||!observations[column].has(selected.yesLabel!)||!observations[column].has(selected.noLabel!))) throw new ValidationError('Confirm Yes/No only for exactly two observed whole labels.')
    const completion=form.steps.findIndex(s=>s.kind==='completion')
    form.steps.splice(completion<0?form.steps.length:completion,0,step)
    form.report.push({location:`/csv/questions/${column}`,label:title,sourceType:'CSV-only question',state:'changed',change:step.questionType!,reason:googleIdentity(title)?'Explicitly retained as ordinary email answer data only; never contact, invitation, session or notification identity.':grid(title)?'Explicit ordinary question for this grid row; grid layout, validation and routing require native repair.':'Flat editable question. Observed whole-label options cannot establish missing options; branching, required flags, descriptions and source validation are unknown.'})
  }
  for(const selected of overrides) if(selected.sourceId.startsWith('csv:')&&!form.steps.some(s=>s.sourceId===selected.sourceId)) throw new ValidationError('Cannot create a question from a forbidden, timestamp or missing CSV column.')
  if(!parsed) {
    form.steps.push({id:stableId(scope,'generated-completion'),sourceId:'generated-completion',sourceType:'generated',kind:'completion',questionType:null,prompt:'Thank you',helperText:null,required:false,settings:{},choices:[],next:null})
    form.steps.forEach((s,i)=>{if(s.kind!=='completion')s.next=form.steps[i+1]?.id??null})
    form.report.push({location:'/csv/reconstruction',label:'CSV-only reconstruction',sourceType:'missing definition',state:'changed',change:'Flat editable draft; types require operator choice',reason:'CSV does not contain complete option lists, branching, required flags, descriptions, validations, source settings or reliable identification of every upload/quiz column. Suggestions are observations only and are never applied automatically.'})
  } else {
    // Explicit new grid/email questions have no inferred position in the original graph.
    for(const step of form.steps.filter(s=>s.sourceId.startsWith('csv:'))) step.next=null
  }
  const columns:ColumnMapping[]=headers.map((header,column)=>{
    let target='skip'
    if(!hardColumns.has(column)) {
      const explicit=form.steps.find(s=>s.sourceId===`csv:${column}`)
      if(explicit && headers.filter(h=>h===header).length===1) target=explicit.id
      else if(/^timestamp$/i.test(header)&&headers.filter(h=>/^timestamp$/i.test(h)).length===1) target='submittedAt'
      else if(!metadata(header)&&headers.filter(h=>h===header).length===1) { const matches=form.steps.filter(s=>s.kind==='question'&&(s.sourceId===header||s.prompt===header)); if(matches.length===1) target=matches[0].id }
    }
    return {column,target}
  })
  return {form,forbidden,hardColumns,hardReasons,skipReasons,counts,columns,review}
}
const driveFileCell=(value:string)=>value.split(/,\s*/).every(link=>/^https?:\/\/drive\.google\.com\/(?:open\?id=|file\/d\/)[\w-]+\S*$/i.test(link.trim()))
