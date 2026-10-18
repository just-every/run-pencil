import { earlierRecallQuestions, type FlowGraph } from '../../../shared/answerRecall'

export function RecallHelp({ flow, currentStepId, onInsert, disabled }: { flow: FlowGraph; currentStepId: string; onInsert: (reference: string) => void; disabled: boolean }) {
  const earlier = earlierRecallQuestions(flow, currentStepId)
  return <details className="recall-help">
    <summary className="focus-ring">Insert an earlier answer</summary>
    <p className="muted">Choose an earlier answer to insert at the end of this prompt. You can move its reference into supporting text, a choice label or a completion screen. It shows that answer on the respondent’s current path and stays blank when the question was skipped. Going back and changing an answer updates the recalled text.</p>
    {earlier.length ? <ul aria-label="Earlier questions available for answer recall">
      {earlier.map(step => <li key={step.id} style={{ overflowWrap: 'anywhere' }}><button type="button" disabled={disabled} className="quiet-button focus-ring" onClick={() => onInsert(`{{${step.id}}}`)}>Insert answer: {step.prompt}</button></li>)}
    </ul> : <p className="muted">No earlier questions lead to this screen. Add a question before using answer recall here.</p>}
    {flow.formSettings?.hiddenFields.length ? <ul aria-label="Hidden fields available for recall">{flow.formSettings.hiddenFields.map(field=><li key={field.id}><button className="quiet-button" type="button" disabled={disabled} onClick={()=>onInsert(`{{hidden:${field.id}}}`)}>Insert hidden field: {field.name}</button></li>)}</ul> : null}
    <p className="muted">Use the complete reference, including both pairs of braces. Recalled answers appear as text. Declared hidden fields are available from the link; absent values stay blank.</p>
  </details>
}
