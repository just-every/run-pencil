import { ulid } from 'ulid'

export const flowTemplates = [
  { id: 'feedback', title: 'Customer feedback', description: 'Ask about a visit and what could be better.' },
  { id: 'nps', title: 'NPS', description: 'Ask how likely customers are to recommend you.' },
  { id: 'lead', title: 'Contact/lead', description: 'Collect a name, email and enquiry.' },
] as const
export type FlowTemplateId = typeof flowTemplates[number]['id']

type TemplateQuestion = { prompt: string; questionType: 'single_choice' | 'rating' | 'nps' | 'long_text' | 'short_text' | 'email'; labels?: string[]; questionSettings?: Record<string, unknown> }
const questions: Record<FlowTemplateId, TemplateQuestion[]> = {
  feedback: [
    { prompt: 'How was your visit?', questionType: 'single_choice', labels: ['Great', 'Good', 'Could be better'] },
    { prompt: 'What could we do better?', questionType: 'long_text' },
  ],
  nps: [
    { prompt: 'How likely are you to recommend us to a friend?', questionType: 'nps', questionSettings: { lowLabel: 'Not at all likely', highLabel: 'Extremely likely' } },
    { prompt: 'What is the main reason for your score?', questionType: 'long_text' },
  ],
  lead: [
    { prompt: 'What is your name?', questionType: 'short_text' },
    { prompt: 'What is your email address?', questionType: 'email' },
    { prompt: 'How can we help?', questionType: 'long_text' },
  ],
}

/** The first question a template asks, for the New flow panel's preview. */
export function templatePreview(template: FlowTemplateId) {
  const { prompt, questionType, labels = [] } = questions[template][0]
  return { prompt, questionType, labels }
}

export function templateStructure(template: FlowTemplateId, revisionId: string, now: string) {
  const definitions = questions[template]
  const ids = Array.from({ length: definitions.length + 1 }, () => ulid())
  const steps = ids.map((id, position) => {
    const question = definitions[position]
    return { id, revisionId, stableId: ulid(), position, kind: question ? 'question' as const : 'completion' as const, questionType: question?.questionType ?? null, prompt: question?.prompt ?? 'Thank you. Your response has been received.', helperText: null, required: (!!question && position === 0) || question?.questionType === 'email', nextStepStableId: null as string | null, questionSettingsJson: question?.questionSettings ? JSON.stringify(question.questionSettings) : null, createdAt: now, updatedAt: now }
  })
  steps.forEach((step, position) => { step.nextStepStableId = steps[position + 1]?.stableId ?? null })
  const choices = definitions.flatMap((question, index) => (question.labels ?? []).map((label, position) => ({ id: ulid(), stepId: ids[index], stableId: ulid(), value: label.toLowerCase().replaceAll(' ', '-'), label, position, createdAt: now, updatedAt: now })))
  return { steps, choices }
}
