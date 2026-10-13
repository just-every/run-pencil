import { TextAnswers } from './TextAnswers'
import type { QuestionReport } from '../../../app/api'
const number = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(1)
export const answerCount = (value: number) => `${value} ${value === 1 ? 'answer' : 'answers'}`
export function AnswerEvidence({ question, flowId }: { question: QuestionReport; flowId: string }) {
  const summary = question.summary
  // Choice answers wear the landing's answer washes by position; scales and numbers stay on paper.
  const washed = question.questionType === 'single_choice' || question.questionType === 'multiple_choice' || question.questionType === 'dropdown'
  return <div className="answer-evidence">
    <p className="muted">{answerCount(question.answered)}</p>
    {question.importedAnswered ? <p className="muted">{answerCount(question.importedAnswered)} imported</p> : null}
    {summary.average !== undefined ? <p>Average rating <strong>{number(summary.average)}</strong></p> : null}
    {summary.score !== undefined ? <><p>NPS <strong>{number(summary.score)}</strong></p><p>Promoters {summary.promoters} · Passives {summary.passives} · Detractors {summary.detractors}</p></> : null}
    {summary.median !== undefined ? <p>Minimum <strong>{summary.minimum}</strong> · Median <strong>{summary.median}</strong> · Maximum <strong>{summary.maximum}</strong></p> : null}
    {summary.earliest ? <p>Earliest <strong>{summary.earliest}</strong> · Latest <strong>{summary.latest}</strong></p> : null}
    {summary.positions?.map(position => <p key={position.id}>{position.label}: average position <strong>{question.answered ? number(position.average) : 'No answers'}</strong></p>)}
    {question.distribution.length ? <><p className="muted answer-scope">{question.distributionLabel}</p>{question.distribution.map((bucket, index) => <div className="answer-bucket" key={JSON.stringify(bucket.value)}><div className="answer-bucket__label"><span className="answer-chip" data-wash={washed && index < 3 ? index : undefined}>{bucket.label}</span><strong>{bucket.count} of {answerCount(question.answered)} · {question.answered ? Math.round(bucket.count / question.answered * 100) : 0}%</strong></div><div className="device-bar" style={{ width: '100%' }}><span style={{ width: `${question.answered ? bucket.count / question.answered * 100 : 0}%` }} /></div></div>)}</> : null}
    {summary.texts && question.revisionId ? <TextAnswers flowId={flowId} revisionId={question.revisionId} questionId={question.id} /> : null}
    {!question.answered ? <p className="muted">No answers yet.</p> : null}
  </div>
}
