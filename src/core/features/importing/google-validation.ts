import manifest from '../../../../seed.json'
import { ValidationError } from '../../shared/errors'
const record = (value:unknown):value is Record<string,any> => !!value && typeof value==='object' && !Array.isArray(value)
const invalid = ():never => { throw new ValidationError('Malformed Google forms.get resource: item/question unions, identities, options and routing values must use the documented JSON shape.') }
export function validateGoogleDefinition(definition:Record<string,any>) {
  if(!record(definition.info)||typeof definition.info.title!=='string'||!definition.info.title.trim()||!Array.isArray(definition.items)) invalid()
  if(definition.items.length>manifest.limits.steps.perRevision) throw new ValidationError('Google definition exceeds the configured native step limit.')
  const items=new Set<string>(), questions=new Set<string>()
  const question=(q:unknown)=>{
    if(!record(q)) return invalid()
    if(typeof q.questionId!=='string'||!q.questionId||q.questionId.startsWith('csv:')||questions.has(q.questionId)) invalid()
    questions.add(q.questionId)
    if(q.required!==undefined&&typeof q.required!=='boolean') invalid()
    const kinds=['textQuestion','choiceQuestion','scaleQuestion','dateQuestion','timeQuestion','fileUploadQuestion','rowQuestion','ratingQuestion'].filter(k=>q[k]!==undefined)
    if(kinds.length!==1||!record(q[kinds[0]])) invalid()
    const kind=kinds[0], value=q[kind]
    if(kind==='choiceQuestion') {
      if(!['RADIO','CHECKBOX','DROP_DOWN'].includes(value.type)||!Array.isArray(value.options)) invalid()
      if(value.options.length>manifest.limits.steps.choiceOptionsPerStep) throw new ValidationError('Google choices exceed the configured native choice limit.')
      if(value.shuffle!==undefined&&typeof value.shuffle!=='boolean') invalid()
      if(value.options.filter((option:unknown)=>record(option)&&option.isOther===true).length>1 || value.type==='DROP_DOWN'&&value.options.some((option:unknown)=>record(option)&&option.isOther===true)) invalid()
      for(const option of value.options) {
        if(!record(option)||typeof option.value!=='string'||option.goToAction!==undefined&&typeof option.goToAction!=='string'||option.goToSectionId!==undefined&&(typeof option.goToSectionId!=='string'||!option.goToSectionId)||option.isOther!==undefined&&typeof option.isOther!=='boolean') invalid()
      }
    }
    if(kind==='textQuestion'&&value.paragraph!==undefined&&typeof value.paragraph!=='boolean') invalid()
    if(kind==='dateQuestion'&&['includeTime','includeYear'].some(k=>value[k]!==undefined&&typeof value[k]!=='boolean')) invalid()
    if(kind==='scaleQuestion'&&(!Number.isInteger(value.low)||!Number.isInteger(value.high)||['lowLabel','highLabel'].some(k=>value[k]!==undefined&&typeof value[k]!=='string'))) invalid()
    if(kind==='ratingQuestion'&&!Number.isInteger(value.ratingScaleLevel)) invalid()
  }
  for(const item of definition.items) {
    if(!record(item)||typeof item.itemId!=='string'||!item.itemId||items.has(item.itemId)||['title','description'].some(k=>item[k]!==undefined&&typeof item[k]!=='string')) invalid()
    items.add(item.itemId)
    const kinds=['questionItem','questionGroupItem','pageBreakItem','textItem','imageItem','videoItem'].filter(k=>item[k]!==undefined)
    if(kinds.length!==1||!record(item[kinds[0]])) invalid()
    if(kinds[0]==='questionItem') question(item.questionItem.question)
    if(kinds[0]==='questionGroupItem') { if(!Array.isArray(item.questionGroupItem.questions)) invalid(); for(const q of item.questionGroupItem.questions) question(q) }
  }
}
