import { earlierRecallQuestions, type FlowGraph } from '../../../shared/answerRecall'

export function RecallHelp({ flow, currentStepId, onInsert, disabled }: { flow: FlowGraph; currentStepId: string; onInsert: (reference: string) => void; disabled: boolean }) {
  const earlier = earlierRecallQuestions(flow, currentStepId)
  return <details className="recall-help">
    <summary className="focus-ring">Insert an earlier answer</summary>
    <p className="muted">Choose an earlier answer to insert at the end of this prompt. You can move its reference into supporting text, a choice label or a completion screen. It shows that answer on the respondent’s current path and stays blank when the question was skipped. Going back and changing an answer updates the recalled text.</p>
    {earlier.length ? <ul aria-label="Earlier questions available for answer recall">
      {earlier.map(step => <li key={step.id} style={{ overflowWrap: 'anywhere' }}><button type="button" disabled={disabled} className="quiet-button focus-ring" onClick={() => onInsert(`{{${step.id}}}`)}>Insert answer: {step.prompt}</button></li>)}
    </ul> : <p className="muted">No earlier questions lead to this screen. Add a question before using answer recall here.</p>}
    <p className="muted">Use the complete reference, including both pairs of braces. Recalled answers appear as text. Hidden fields and calculated values are not available.</p>
  </details>
}
