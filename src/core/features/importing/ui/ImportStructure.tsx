import type { ImportStep } from '../model'
import { typeLabel } from './report-labels'
import type { ScreenLayout } from '../../../shared/screenLayout'

export function ImportStructure({ questions }: { questions: ImportStep[] }) {
  const byId = new Map(questions.map(question => [question.id, question]))
  const contained = new Set<string>()
  const screens = questions.flatMap(question => {
    const screen = question.settings.screen as ScreenLayout | undefined
    if (screen?.kind !== 'group' || !Array.isArray(screen.questionIds)) return []
    const members = screen.questionIds.flatMap(id => typeof id === 'string' && byId.has(id) ? [byId.get(id)!] : [])
    members.slice(1).forEach(member => contained.add(member.id))
    return [{ id: question.id, title: screen.title, description: screen.description, members }]
  })
  if (!screens.length) return null
  const questionLabel = (question: ImportStep) => <>{question.prompt} · {typeLabel(question.questionType ?? 'question')}{question.required ? ' · Required' : ''}</>
  return <section aria-label="Imported form structure">
    <h3>Question screens</h3>
    <ol>{questions.filter(question => !contained.has(question.id)).map(question => {
      const group = screens.find(screen => screen.id === question.id)
      return <li key={question.id}>{group ? <><strong>{group.title}</strong>{group.description ? <p>{group.description}</p> : null}<ol>{group.members.map(member => <li key={member.id}>{questionLabel(member)}</li>)}</ol></> : questionLabel(question)}</li>
    })}</ol>
  </section>
}
