import type { ChoiceOption, FlowStep } from '../../app/api'
import { QuestionInput } from './QuestionInput'

export function ScreenQuestions({steps,choices,answers,errors,disabled,recall,onChange}:{steps:FlowStep[];choices:ChoiceOption[];answers:Record<string,unknown>;errors:Record<string,string>;disabled:boolean;recall:(text:string,stepId:string)=>string;onChange:(id:string,value:unknown)=>void}) {
  return <div className="screen-questions">{steps.filter(step=>step.kind==='question').map(step=>{
    const displayed={...step,prompt:recall(step.prompt,step.id),helperText:step.helperText?recall(step.helperText,step.id):null}
    const options=choices.filter(choice=>choice.stepId===step.id).map(choice=>({...choice,label:recall(choice.label,step.id)}))
    return <section key={step.id} className="screen-question" aria-labelledby={`question-${step.id}`}>
      <h2 className="display" id={`question-${step.id}`}>{displayed.prompt}</h2>
      {displayed.helperText?<p className="respondent-helper">{displayed.helperText}</p>:null}
      {step.required?<p className="respondent-required">Required</p>:null}
      <fieldset className="plain-fieldset" disabled={disabled} aria-labelledby={`question-${step.id}`} aria-describedby={errors[step.id]?`issue-${step.id}`:undefined}>
        <QuestionInput step={displayed} choices={options} value={answers[step.id]} onChange={value=>onChange(step.id,value)}/>
      </fieldset>
      {errors[step.id]?<p id={`issue-${step.id}`} className="status-note" data-tone="error" role="alert">{errors[step.id]}</p>:null}
    </section>
  })}</div>
}
