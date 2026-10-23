import { hasResponseFilter } from '../../../shared/reportFilters'
import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { StepSessionMetrics } from './StepSessionMetrics'
import { AnswerEvidence } from './AnswerEvidence'
import { AppNote } from '../../../app/ui/AppNote'
import type { LedgerFilter, Ledger, QuestionReport } from '../../../app/api'

/** One card per question, in a grid that `children` (the device split) joins as its last card. */
export function QuestionResults({ questions, flowId, children, filter = {}, revisions }: { questions: QuestionReport[]; flowId: string; children?: ReactNode; filter?: LedgerFilter; revisions?: Ledger['revisions'] }) {
  const asked = questions.filter(question => question.questionType)
  const noted = asked.find(question => question.distribution.length)
  return <section className="question-results" aria-labelledby="questions-title"><p className="eyebrow">Question results</p><h2 id="questions-title" className="display">Answers</h2><div className="answers-grid">{asked.map(question => <article className="panel results-card question-card" key={`${question.revisionId}:${question.id}`}>{question === noted ? <AppNote className="results-note" wideOnly>counted honestly</AppNote> : null}<h3 className="display">{question.prompt}</h3>{revisions ? <p className="muted">Revision {revisions.find(revision=>revision.id===question.revisionId)?.number}</p> : null}<AnswerEvidence question={question} flowId={flowId} filter={filter} />{question.revisionId ? <p><Link className="secondary-button focus-ring" to="/app/actions/new" search={{ flowId, revisionId: question.revisionId, questionId: question.id }} aria-label={`Turn this into an action: ${question.prompt}`}>Turn this into an action</Link></p> : null}<details><summary>How we count</summary><p className="muted">Released answers exclude quarantine and erased responses; active sessions remain pending. Released responses only. Answer shares use {question.answered} answers to this question, not starts. Multiple selections count once per selected option. Skipped questions have no recorded answer. Imported answers contribute to answer shares, and do not create sessions or drop-off. Historical sessions remain after response erasure.</p>{hasResponseFilter(filter) ? <p className="muted">Question reach and drop-off are session-wide and are not rates for this response selection.</p> : <StepSessionMetrics reached={question.reached} dropped={question.dropped} answered={question.answered - question.importedAnswered} />}</details></article>)}{children}</div></section>
}
