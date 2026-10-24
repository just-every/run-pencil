import { templatePreview, type FlowTemplateId } from '../../flows'

/** The chosen template's first question on the landing's note sheet, as respondents will meet it. */
export function TemplatePreview({ template }: { readonly template: FlowTemplateId }) {
  const { prompt, questionType, labels, branching } = templatePreview(template)
  return <figure className="note-sheet template-preview" aria-label="First question preview">
    {branching ? <p>Positive → What to keep · Needs attention → What to improve</p> : null}
    <p className="display template-preview__prompt">{prompt}</p>
    {labels.length ? <div className="template-preview__answers">{labels.map((label, index) => <span className="answer-chip" data-wash={index < 3 ? index : undefined} key={label}>{label}</span>)}</div>
      : questionType === 'nps' ? <div className="template-preview__scale">{Array.from({ length: 11 }, (_, score) => <span key={score}>{score}</span>)}</div>
        : <span className="template-preview__line" />}
  </figure>
}
