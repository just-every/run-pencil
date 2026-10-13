import type { ReactNode } from 'react'
import { PencilCircle } from '../marks/PencilCircle'
import { SketchFrame, type SketchTone } from '../marks/SketchFrame'
import { sample } from '../sample'

/** A drawn select: its label and chosen value, as BranchEditor.tsx and the step inspector label them. */
function Field({ label, tone = 'plain', children }: { readonly label: string; readonly tone?: SketchTone; readonly children: ReactNode }) {
  return (
    <span className="rules-sheet__field">
      <span className="plate-label">{label}</span>
      <SketchFrame as="span" tone={tone} radius={6} className="rules-sheet__value">{children}</SketchFrame>
    </span>
  )
}

const rules = [
  { name: 'Rule 1', tone: 'sage', path: sample.great },
  { name: 'Rule 2', tone: 'eraser', path: sample.better },
] as const

/**
 * The builder's answer paths for "How was your visit?" (a single choice): its two rules, each named as BranchEditor's
 * legend names it, and the step's "Default next screen", circled, which "Good" takes because no rule matches it.
 */
export function RulesSheet() {
  return (
    <SketchFrame tone="sheet" radius={10} className="plate-sheet rules-sheet">
      {rules.map(rule => (
        <div key={rule.name} className="rules-sheet__rule">
          <p className="rules-sheet__name">{rule.name}</p>
          <p className="rules-sheet__fields">
            <Field label="Answer" tone={rule.tone}>{rule.path.answer}</Field>
            <Field label="Then go to">{rule.path.next}</Field>
          </p>
        </div>
      ))}
      <p className="rules-sheet__default">
        <PencilCircle block><Field label="Default next screen">{sample.good.next}</Field></PencilCircle>
      </p>
    </SketchFrame>
  )
}
