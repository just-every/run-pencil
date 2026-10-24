import type { BiasFlag } from './model'
/** Conservative planning at 95% confidence and maximum variance p=.5, with finite-population correction. */
export function sampleSize(population:number,margin:number) {
  if(!Number.isInteger(population)||population<1||population>1_000_000_000||!Number.isFinite(margin)||margin<.01||margin>.2)throw new Error('Choose a population and margin within the planning limits.')
  const initial=1.96**2*.5*.5/margin**2
  return Math.ceil(population*initial/(initial+population-1))
}
/** Advisory only: a flag never edits or blocks a question. */
export function biasFlags(stepId:string,prompt:string,choices:readonly string[]):BiasFlag[] {
  const flags:BiasFlag[]=[]
  const add=(kind:BiasFlag['kind'],reason:string)=>flags.push({stepId,kind,reason,source:'deterministic'})
  if(/\b(don['’]?t you agree|wouldn['’]?t you|surely|obviously|isn['’]?t it)\b/i.test(prompt))add('leading','This wording suggests the answer to give.')
  if(/\b(and|or)\b/i.test(prompt)&&/\?/.test(prompt))add('double_barreled','This may ask about two things in one answer; consider separate questions.')
  if(/\b(excellent|terrible|lazy|irresponsible|incompetent|disastrous|corrupt|wonderful)\b/i.test(prompt))add('loaded','Emotionally charged wording may influence the answer.')
  if(choices.length>1){
    const positive=choices.filter(value=>/\b(great|good|excellent|satisfied|easy|love)\b/i.test(value)).length
    const negative=choices.filter(value=>/\b(bad|poor|terrible|dissatisfied|difficult|hate|not)\b/i.test(value)).length
    const neutral=choices.some(value=>/\b(neutral|neither|average|unsure)\b/i.test(value))
    if(!neutral&&(positive===choices.length||negative===choices.length))add('unbalanced','The offered answers may omit the other side of the scale.')
  }
  return flags
}
