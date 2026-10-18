import { formLimits } from '../../shared/formLimits'
import { Buffer } from 'node:buffer'
import { z } from 'zod'
const question = z.object({ sourceId:z.string().min(1).max(200), type:z.enum(['short_text','long_text','email','single_choice','multiple_choice','dropdown','yes_no','rating','nps','number','date']), choices:z.array(z.string().min(1).max(300)).max(formLimits.questions.dropdownChoices).optional(), min:z.number().int().optional(), max:z.number().int().optional(), confirmYesNo:z.boolean().optional(), yesLabel:z.string().min(1).max(300).optional(), noLabel:z.string().min(1).max(300).optional() }).strict()
export const importFiles = z.object({ source:z.enum(['typeform','google-forms']).optional(), google:z.object({timeZone:z.string().min(1).max(formLimits.questions.dropdownChoices).optional(),dateOrder:z.enum(['DMY','MDY','YMD']).optional(),title:z.string().min(1).max(200).optional(),questions:z.array(question).max(formLimits.questions.perRevision).optional()}).strict().optional(), plannedAt:z.string().datetime().optional(), definition:z.string().max(8*1024*1024), csv:z.string().max(8*1024*1024), columns:z.array(z.object({column:z.number().int().nonnegative(),target:z.string().min(1).max(200),choice:z.string().max(200).optional()}).strict()).max(5100).optional() }).strict()
export const sourceInputIssue = (value:z.infer<typeof importFiles>,ctx:z.RefinementCtx) => {
  if(value.source!=='google-forms'&&(!value.definition.trim()||value.google)) ctx.addIssue({code:'custom',message:'Typeform requires a definition and cannot use Google settings.'})
  if(value.source==='google-forms'&&!value.definition.trim()&&!value.csv.trim()) ctx.addIssue({code:'custom',message:'Google requires a definition or response CSV.'})
  if(Buffer.byteLength(value.definition)+Buffer.byteLength(value.csv)>8*1024*1024) ctx.addIssue({code:'custom',message:'Combined upload exceeds 8 MiB.'})
}
