/**
 * The one illustrative flow the hero card and every plate draw: the "Customer feedback" template (flows/templates.ts) with a follow-up
 * question for each answer, then the template's completion screen. Its answer paths: Rule 1 sends "Great" to its
 * follow-up, Rule 2 sends "Could be better" to its follow-up, and "Good" takes the default next screen, its own
 * follow-up. The slug is the dashboard's own placeholder ("post-visit-feedback") and the origin a reserved example
 * domain. The follow-ups for "Great" and "Good", the rules and the origin are invented for the drawing; the results
 * plate's numbers live in results-sample.ts and are labelled as sample numbers on the page.
 */
const question = 'How was your visit?'
const great = { answer: 'Great', next: 'What made it great?' }
const good = { answer: 'Good', next: 'What would make it great?' }
const better = { answer: 'Could be better', next: 'What could we do better?' }
const completion = 'Thank you. Your response has been received.'

export const sample = {
  slug: 'post-visit-feedback',
  origin: 'https://feedback.example',
  question,
  great,
  good,
  better,
  /** The flow's screens in builder order, as its current revision holds them. */
  steps: [question, great.next, good.next, better.next, completion],
  /** Revision 1 was the template as created: one question, its one follow-up, the completion screen. */
  firstRevisionSteps: [question, better.next, completion],
  /** The questions a respondent who answers "Could be better" meets, in order; the completion screen follows. */
  betterPath: [question, better.next],
} as const

/**
 * The share panel's three copy fields, built as FlowSharePanel's flowShareLinks() builds them, each cut to one line:
 * "…" marks where the origin and the trailing attributes and closing tag were left out.
 */
export const shareFields = [
  { label: 'Public link', value: `${sample.origin}/f/${sample.slug}` },
  { label: 'Script embed', value: `<script async src="…/embed.js?flow=${sample.slug}" …>` },
  { label: 'Embed code', value: `<iframe src="…/embed/${sample.slug}" …>` },
] as const
