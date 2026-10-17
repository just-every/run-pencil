import type { QuestionReport } from '../../../app/api'

export function StructuredAnswerFilter({ question, value, onChange }: { question: QuestionReport; value?: string; onChange: (value: string | undefined) => void }) {
  const type = question.questionType
  const boolean = type === 'yes_no' || type === 'consent' || type === 'thumbs_rating'
  const writeIns = ['single_choice', 'multiple_choice', 'dropdown'].includes(type ?? '') && question.summary.texts !== undefined
  const selectedChoice = question.choices.some(choice => choice.id === value)
  return <><label className="inspector-field">Answer contains / equals
    {boolean || question.choices.length ? <select className="text-input" value={writeIns && !selectedChoice ? '' : value ?? ''} onChange={event => onChange(event.target.value || undefined)}>
      <option value="">Any value</option>
      {boolean ? <><option value="true">{type === 'consent' ? 'Accepted' : type === 'thumbs_rating' ? 'Thumbs up' : 'Yes'}</option><option value="false">{type === 'consent' ? 'Declined' : type === 'thumbs_rating' ? 'Thumbs down' : 'No'}</option></> : question.choices.map(choice => <option key={choice.id} value={choice.id}>{choice.label}</option>)}
    </select> : <input className="text-input" type={type === 'date' ? 'date' : ['number', 'nps', 'rating', 'csat', 'ces', 'emoji_rating'].includes(type ?? '') ? 'number' : 'text'} step={type === 'number' ? 'any' : undefined} value={value ?? ''} onChange={event => onChange(event.target.value || undefined)} />}
  </label>{writeIns ? <label className="inspector-field">Write-in text equals<input className="text-input" type="text" value={selectedChoice ? '' : value ?? ''} onChange={event => onChange(event.target.value || undefined)} /><span className="muted">An exact write-in match replaces the choice selection.</span></label> : null}</>
}
