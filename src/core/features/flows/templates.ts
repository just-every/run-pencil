import { ulid } from 'ulid'
import { templateCatalog as catalog, catalogPrompts } from './templates/catalog'

const originalTemplates = [
  { id: 'feedback', title: 'Customer feedback', description: 'Ask about a visit and what could be better.' },
  { id: 'nps', title: 'NPS', description: 'Ask how likely customers are to recommend you.' },
  { id: 'lead', title: 'Contact/lead', description: 'Collect a name, email and enquiry.' },
] as const
export const flowTemplates = [...originalTemplates.map(item => ({ ...item, category: item.id === 'feedback' ? 'Customer feedback' : item.id === 'nps' ? 'NPS' : 'Contact and lead capture' })), ...catalog]
/** The three starters shown before anyone searches or picks a category. */
export const starterTemplateIds: ReadonlySet<string> = new Set(originalTemplates.map(item => item.id))
export type FlowTemplateId = string

type TemplateQuestion = { prompt: string; questionType: 'single_choice' | 'rating' | 'nps' | 'long_text' | 'short_text' | 'email' | 'csat' | 'ces'; labels?: string[]; questionSettings?: Record<string, unknown> }
const originalQuestions: Record<string, TemplateQuestion[]> = {
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

function questionsFor(template: FlowTemplateId): TemplateQuestion[] {
  if (originalQuestions[template]) return originalQuestions[template]
  const item = catalog.find(item => item.id === template)
  if (!item) throw new Error('Choose a gallery template.')
  const category = item.id.split('-')[0]
  if (category === 'satisfaction' || category === 'effort') return [
    { prompt: category === 'satisfaction' ? 'How satisfied were you with this experience?' : 'How easy was it to complete your task?', questionType: category === 'satisfaction' ? 'csat' : 'ces' },
    { prompt: 'What made this difficult or disappointing?', questionType: 'long_text' },
    { prompt: 'What worked well for you?', questionType: 'long_text' },
  ]
  if (['customer', 'research', 'employee'].includes(category) && template !== 'employee-6') return [
    { prompt: catalogPrompts[category][Number(template.split('-')[1]) - 1], questionType: 'single_choice', labels: ['Positive', 'Needs attention'] },
    { prompt: `What should we improve?`, questionType: 'long_text' },
    { prompt: 'What should we keep doing?', questionType: 'long_text' },
  ]
  if (category === 'recommendation' || template === 'employee-6') return [
    { prompt: template === 'employee-6' ? 'How likely are you to recommend working here to a friend?' : 'How likely are you to recommend us to a friend or colleague?', questionType: 'nps' },
    { prompt: 'What is the main reason for your score?', questionType: 'long_text' },
  ]
  return [
    { prompt: 'What is your name?', questionType: 'short_text' },
    { prompt: 'What is your email address?', questionType: 'email' },
    { prompt: catalogPrompts[category][Number(template.split('-')[1]) - 1], questionType: 'long_text' },
  ]
}

/** The first question a template asks, for the New flow panel's preview. */
export function templatePreview(template: FlowTemplateId) {
  const { prompt, questionType, labels = [] } = questionsFor(template)[0]
  return { prompt, questionType, labels, branching: !originalQuestions[template] && (labels.length > 0 || ['csat', 'ces'].includes(questionType)) }
}

export function templateStructure(template: FlowTemplateId, revisionId: string, now: string) {
  const definitions = questionsFor(template)
  const ids = Array.from({ length: definitions.length + 1 }, () => ulid())
  const steps = ids.map((id, position) => {
    const question = definitions[position]
    return { id, revisionId, stableId: ulid(), position, kind: question ? 'question' as const : 'completion' as const, questionType: question?.questionType ?? null, prompt: question?.prompt ?? 'Thank you. Your response has been received.', helperText: null, required: (!!question && position === 0) || question?.questionType === 'email', nextStepStableId: null as string | null, questionSettingsJson: question?.questionSettings ? JSON.stringify(question.questionSettings) : null, createdAt: now, updatedAt: now }
  })
  steps.forEach((step, position) => { step.nextStepStableId = steps[position + 1]?.stableId ?? null })
  const choices = definitions.flatMap((question, index) => (question.labels ?? []).map((label, position) => ({ id: ulid(), stepId: ids[index], stableId: ulid(), value: label.toLowerCase().replaceAll(' ', '-'), label, position, createdAt: now, updatedAt: now })))
  const branching = !originalQuestions[template] && (definitions[0].labels?.length || ['csat', 'ces'].includes(definitions[0].questionType))
  const rules = branching ? [{ id: ulid(), revisionId, sourceStepStableId: steps[0].stableId, destinationStepStableId: steps[2].stableId, predicateKind: choices.length ? 'equals' as const : 'greater_than' as const, expectedValueJson: JSON.stringify(choices.length ? choices[0].stableId : definitions[0].questionType === 'csat' ? 3 : 4), position: 0, createdAt: now, updatedAt: now }] : []
  if (branching) steps[1].nextStepStableId = steps.at(-1)!.stableId
  return { steps, choices, rules }
}
