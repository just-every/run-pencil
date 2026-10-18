import type { BuilderDraft } from '../../../app/api'
import { earlierRecallQuestions } from '../../../shared/answerRecall'
import { hiddenOperands } from '../../../shared/hiddenFields'
import { calculationOperands } from '../../../shared/calculationInputs'
import type { CompletionRedirect } from '../../../shared/completionRedirect'

export function CompletionSettings({draft,stepId,value,onChange,disabled}:{draft:BuilderDraft;stepId:string;value:unknown;onChange:(value:CompletionRedirect|undefined)=>void;disabled:boolean}) {
  const redirect = value as CompletionRedirect | undefined
  const operands = [...earlierRecallQuestions(draft,stepId),...hiddenOperands(draft.formSettings?.hiddenFields ?? []),...calculationOperands(draft.formSettings?.calculations ?? [])]
  return <details className="quiet-panel"><summary className="focus-ring">Completion redirect</summary>
    <fieldset className="plain-fieldset" disabled={disabled}>
      <legend>After submission</legend>
      <p className="muted">Answer paths choose this completion screen. You can send its respondents to an approved HTTPS destination after their response is saved. Only the parameters you declare here are sent.</p>
      <label className="inspector-field">Completion action<select aria-label="Completion action" className="text-input" value={redirect?'redirect':'screen'} onChange={event=>onChange(event.target.value==='redirect'?{url:'',parameters:[]}:undefined)}><option value="screen">Show this completion screen</option><option value="redirect">Redirect after saving</option></select></label>
      {redirect ? <><label className="inspector-field">Redirect URL<input className="text-input" type="url" value={redirect.url} onChange={event=>onChange({...redirect,url:event.target.value})}/></label>
        <p className="muted">Approve the destination’s origin in Publication options → Approved redirect origins before publishing.</p>
        {redirect.parameters.map((item,index)=><fieldset className="quiet-panel" key={index}><legend>Parameter {index+1}</legend>
          <label className="inspector-field">Parameter name {index+1}<input className="text-input" maxLength={64} value={item.name} onChange={event=>onChange({...redirect,parameters:redirect.parameters.map((entry,i)=>i===index?{...entry,name:event.target.value}:entry)})}/></label>
          <label className="inspector-field">Parameter value {index+1}<select aria-label={`Parameter value ${index+1}`} className="text-input" value={item.operand} onChange={event=>onChange({...redirect,parameters:redirect.parameters.map((entry,i)=>i===index?{...entry,operand:event.target.value}:entry)})}><option value="">Choose an earlier answer or value</option>{operands.map(step=><option value={step.id} key={step.id}>{step.prompt}</option>)}</select></label>
          <button className="quiet-button" type="button" onClick={()=>onChange({...redirect,parameters:redirect.parameters.filter((_,i)=>i!==index)})}>Remove parameter {index+1}</button>
        </fieldset>)}
        <button className="secondary-button focus-ring" type="button" disabled={redirect.parameters.length>=20} onClick={()=>onChange({...redirect,parameters:[...redirect.parameters,{name:'',operand:''}]})}>Add redirect parameter</button>
      </> : null}
    </fieldset>
  </details>
}
