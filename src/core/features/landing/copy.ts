/**
 * Words for the homepage below the hero. Every claim traces to an active CONTRACT.md clause at this commit; plate text
 * itself lives beside each plate and copies the product's own UI strings. `**…**` marks emphasis in a sentence.
 * `docs` is the one guide page (a slug of docs/site.json, with an optional heading id) each section links to.
 */
export const sectionCopy = {
  'one-at-a-time': {
    title: 'One question at a time.',
    sentence: 'People see one question, a count that includes **only** the questions **on their path**, and a way back.',
    plate: 'Sketch of a respondent screen on the “Could be better” path: question 2 of 2, 1 remaining, an empty answer, Back and Submit response.',
    note: 'counts only their path',
    docs: { label: 'What respondents see', slug: 'publish-and-share', hash: 'what-respondents-see' },
  },
  'answer-paths': {
    title: 'Every answer picks the next question.',
    sentence: 'Add rules to a question and each person follows the path their answer chose. Everyone else takes the default.',
    plate: 'Sketch of answer paths: each answer to “How was your visit?” leads to its own next question. Rule 1 sends “Great” to its follow-up, Rule 2 sends “Could be better” to its own, and “Good”, which no rule matches, takes the default next screen.',
    note: 'no rule? they get the default',
    docs: { label: 'How answer paths work', slug: 'branching' },
  },
  preview: {
    title: 'Walk the path before anyone else does.',
    sentence: 'Preview runs your draft with test answers and shows which rule matched. Publishing checks that every path ends in a thank-you.',
    plate: 'Sketch of the draft preview with “Could be better” chosen, beside its evaluated path: Rule 1 does not match, Rule 2 matches and is chosen.',
    note: 'see which rule matched',
    docs: { label: 'Test the paths', slug: 'branching', hash: 'test-the-paths' },
  },
  revisions: {
    title: 'Change your questions, keep your answers.',
    sentence: 'Every publish is a numbered revision. People already answering finish the version they started.',
    plate: 'Sketch of revision 1 behind the current revision 2, which added two follow-up questions, with the publish notice.',
    note: 'people mid-way finish revision 1',
    docs: { label: 'Edit after publishing', slug: 'publish-and-share', hash: 'edit-after-publishing' },
  },
  share: {
    title: 'Ask wherever they are.',
    sentence: 'Share a link, embed it on your site, or email invitations. One reminder follows two days later, inside your sending hours.',
    plate: 'Sketch of the share panel with a public link, a script embed and embed code, and an invitation email with its opt-out link, sent on day 0 and again on day 2.',
    note: 'an opt-out in every message',
    docs: { label: 'Invitations and reminders', slug: 'invitations' },
  },
  kind: {
    title: 'Kind to the people you ask.',
    sentence: 'No cookies, no trackers, no third-party requests. Before the first answer, people are told who will see it. If someone stops halfway, Pencil keeps how far they got, never what they typed.',
    plate: 'Sketch of the “Before you share” privacy card shown with the first question: the response is anonymous, the business’s operators can see the answers, details people choose to type identify them, and the feedback service stores the answers.',
    note: 'said before the first answer',
    docs: { label: 'Privacy and security', slug: 'privacy' },
  },
  results: {
    title: 'Hear every answer, counted honestly.',
    sentence: 'Answers to every question, where people stopped, and starts and completions for each revision, with exports of exactly what you filtered.',
    plate: 'Sketch of the results for a sample flow, with sample numbers: responses, starts and completion rate, then the answers to “How was your visit?” as counts and shares, and how many sessions reached that question and ended there.',
    note: 'where people stopped',
    docs: { label: 'Read your results', slug: 'results' },
  },
  'moving-in': {
    title: 'Bring your Typeform forms.',
    sentence: 'Import a Typeform form definition and its responses from CSV, review how every field maps, then keep working in Pencil.',
    plate: 'Sketch of the “Import a form” page with a form definition JSON and an optional response CSV chosen.',
    note: 'your old answers come too',
    docs: { label: 'Moving in', slug: 'moving-in' },
  },
  yours: {
    title: 'Yours, down to the last answer.',
    sentence: 'Pencil is MIT licensed. Export everything, any time.',
    plate: 'Sketch of a terminal running a deploy check, then deploy and export.',
    note: 'every record, one private file',
    docs: { label: 'Read the guide', slug: 'hosting' },
  },
} as const

export type SectionId = keyof typeof sectionCopy

export const closeCopy = {
  id: 'start',
  title: 'Ask your first question.',
  sentence: 'Free and open source.',
  docs: 'Read the docs',
  install: { label: 'Run it on your computer', slug: 'install' },
} as const
