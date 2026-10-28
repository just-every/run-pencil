import { MatrixEvidence, answerCount } from './MatrixEvidence'
import { TextAnswers } from './TextAnswers'
import type { LedgerFilter, QuestionReport } from '../../../app/api'
const number = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(1)
export { answerCount } from './MatrixEvidence'
export function AnswerEvidence({ question, flowId, filter }: { question: QuestionReport; flowId: string; filter?: LedgerFilter }) {
  const summary = question.summary
  // Choice answers wear the landing's answer washes by position; scales and numbers stay on paper.
  const washed = question.questionType === 'single_choice' || question.questionType === 'multiple_choice' || question.questionType === 'dropdown'
  return <div className="answer-evidence">
    <p className="muted">{answerCount(question.answered)}</p>
    {question.importedAnswered ? <p className="muted">{answerCount(question.importedAnswered)} imported</p> : null}
    {summary.average !== undefined ? <p>Average rating <strong>{number(summary.average)}</strong></p> : null}
    {summary.csat ? <><p>CSAT <strong>{number(summary.csat.percentage)}%</strong></p><p>{summary.csat.satisfied} satisfied answers (4–5) / {summary.csat.answered} answers</p></> : null}
    {summary.ces ? <><p>Mean customer effort <strong>{number(summary.ces.mean)}</strong></p><p>{summary.ces.total} total score / {summary.ces.answered} answers · scale 1–7</p></> : null}
    {summary.score !== undefined ? <><p>NPS <strong>{number(summary.score)}</strong></p><p>Promoters {summary.promoters} · Passives {summary.passives} · Detractors {summary.detractors}</p></> : null}
    {summary.median !== undefined ? <p>Minimum <strong>{summary.minimum}</strong> · Median <strong>{summary.median}</strong> · Maximum <strong>{summary.maximum}</strong></p> : null}
    {summary.earliest ? <p>Earliest <strong>{summary.earliest}</strong> · Latest <strong>{summary.latest}</strong></p> : null}
    {summary.positions?.map(position => <p key={position.id}>{position.label}: average position <strong>{question.answered ? number(position.average) : 'No answers'}</strong></p>)}
    {question.distribution.length ? <><p className="muted answer-scope">{question.distributionLabel}</p>{question.distribution.map((bucket, index) => <div className="answer-bucket" key={JSON.stringify(bucket.value)}><div className="answer-bucket__label"><span className="answer-chip" data-wash={washed && index < 3 ? index : undefined}>{bucket.label}</span><strong>{bucket.count} of {answerCount(question.answered)} · {question.answered ? `${Math.round(bucket.count / question.answered * 100)}%` : 'No rate'}</strong></div><div className="device-bar" style={{ width: '100%' }}><span style={{ width: `${question.answered ? bucket.count / question.answered * 100 : 0}%` }} /></div></div>)}</> : null}
    {summary.matrixRows ? <MatrixEvidence rows={summary.matrixRows} /> : null}
    {summary.texts && question.revisionId ? <TextAnswers flowId={flowId} revisionId={question.revisionId} questionId={question.id} filter={filter} /> : null}
    {!question.answered ? <p className="muted">No answers yet.</p> : null}
  </div>
}
