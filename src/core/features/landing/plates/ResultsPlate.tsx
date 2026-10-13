import type { ReactNode } from 'react'
import { PencilCircle } from '../marks/PencilCircle'
import { SketchFrame } from '../marks/SketchFrame'
import { Plate, PlateNote } from './Plate'
import { answerCount, resultsSample } from './results-sample'

function Metric({ label, value, note }: { readonly label: string; readonly value: ReactNode; readonly note?: string }) {
  return (
    <SketchFrame radius={8} className="metric">
      <p className="plate-label">{label}</p>
      <p className="metric__value">{value}</p>
      {note && <p className="metric__note">{note}</p>}
    </SketchFrame>
  )
}

/**
 * #results: ResultsPage.tsx for one revision of the sample flow, tagged "sample numbers" beside its title: the
 * ledger's two exports, three of the summary cards, then the first question's block from QuestionResults.tsx, its
 * answer count, each choice as "N of M answers · P%" over a bar, and its drop-off line (StepSessionMetrics.tsx, cut
 * before the bracketed repeat), circled for the note beneath. Every number comes from results-sample.ts.
 */
export function ResultsPlate() {
  const { question } = resultsSample
  const answers = answerCount(question.answered)
  return (
    <Plate section="results">
      <SketchFrame tone="sheet" radius={12} stacked className="plate-sheet results-sheet">
        <div className="results-sheet__head">
          <p className="plate-title">{resultsSample.flowTitle} <span className="sample-tag">sample numbers</span></p>
          <p className="results-sheet__exports">
            <SketchFrame as="span" radius={8} className="drawn-button">Export JSON</SketchFrame>
            <SketchFrame as="span" radius={8} className="drawn-button">Export CSV</SketchFrame>
          </p>
        </div>
        <div className="results-sheet__cards">
          <Metric label="Responses" value={resultsSample.responses} />
          <Metric label="Starts" value={resultsSample.starts} />
          <Metric
            label="Completion rate"
            value={resultsSample.completionRate}
            note={`${resultsSample.liveCompletions} live completions / ${resultsSample.starts} starts`}
          />
        </div>
        <p className="results-sheet__question">{question.prompt} <span className="plate-label">{answers}</span></p>
        <ul className="results-sheet__choices">
          {question.choices.map(choice => (
            <li key={choice.label}>
              <span className="results-sheet__choice">
                <span>{choice.label}</span>
                <span>{choice.count} of {answers} · {choice.share}%</span>
              </span>
              <span className="drawn-bar" aria-hidden="true"><span style={{ width: `${choice.width}%` }} /></span>
            </li>
          ))}
        </ul>
        <p className="results-sheet__dropoff">
          <PencilCircle block>
            {question.reached} distinct sessions reached · {question.dropped} expired sessions ended here · {question.dropOff}% drop-off
          </PencilCircle>
        </p>
      </SketchFrame>
      <PlateNote section="results" />
    </Plate>
  )
}
