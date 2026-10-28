import { ToolRefusal, type ResourceDefinition } from '../../../base/agent-door/index.ts'
import { createDatabase } from '../../platform/db/repository'
import { FlowRepository, publicSteps, publicChoices, publicRules } from '../../features/flows'
import { SubmissionService } from '../../features/submissions/service'
import type { PencilServices } from '../services'
import { nativeCall, nativeScope } from './native'

export function recordResources(db: D1Database, services: PencilServices): ResourceDefinition[] {
  type Reader = (id: string, workspaceId: string) => Promise<unknown | null>
  const readers: Array<[string, string, Reader]> = [
    ['revisions', 'forms', async (id, workspaceId) => {
      const repository = new FlowRepository(createDatabase(db), db), record = await repository.findRevisionById(id)
      if (!record || !await repository.findWorkspaceFlow(record.flowId, workspaceId)) return null
      const graph = await repository.getRevisionGraph(id)
      return { id: record.id, formId: record.flowId, number: record.number, state: record.state, publishedAt: record.publishedAt,
        steps: publicSteps(graph.steps), choices: publicChoices(graph.steps, graph.choices), branchRules: publicRules(graph.rules) }
    }],
    ['responses', 'responses', async (id, workspaceId) => {
      const row = await db.prepare('SELECT flow_id AS formId FROM responses WHERE id=? AND workspace_id=?').bind(id, workspaceId).first<{formId: string}>()
      if (!row) return null
      const workflow = await new SubmissionService(db).detail(workspaceId, row.formId, id)
      const answers = await db.prepare('SELECT step_id AS questionId,value_json AS value FROM response_answers WHERE response_id=? ORDER BY step_id').bind(id).all<{questionId: string; value: string}>()
      return { ...workflow, responseId: id, formId: row.formId, answers: answers.results.map(answer => ({ questionId: answer.questionId, value: JSON.parse(answer.value) })) }
    }],
    ['contacts', 'contacts', async (id, workspaceId) => services.distribution.contacts.get(workspaceId, id)],
    ['analyses', 'analyses', async (id, workspaceId) => services.analysis.records.detail(workspaceId, id)],
    ['findings', 'analyses', async (id, workspaceId) => {
      const row = await db.prepare('SELECT t.run_id AS runId FROM analysis_themes t JOIN analysis_runs r ON r.id=t.run_id WHERE t.id=? AND r.workspace_id=?').bind(id, workspaceId).first<{runId: string}>()
      if (!row) return null
      const finding = (await services.analysis.records.detail(workspaceId, row.runId)).themes.find(theme => theme.id === id)
      return finding && !finding.withheld ? finding : null
    }],
    ['actions', 'actions', async (id, workspaceId) => services.actions.records.get(workspaceId, id)],
    ['deliveries', 'deliveries', async (id, workspaceId) => {
      const row = await db.prepare(`SELECT r.flow_id AS formId FROM mail_deliveries d JOIN invitation_participants p ON p.id=d.participant_id JOIN flow_revisions r ON r.id=p.revision_id WHERE d.id=? AND p.workspace_id=?`).bind(id, workspaceId).first<{formId: string}>()
      if (!row) return null
      const deliveries = await services.distribution.launches.list(workspaceId, row.formId) as unknown as Array<Record<string, unknown>>
      return deliveries.find(delivery => delivery.deliveryId === id) ?? null
    }],
  ]
  return readers.map(([area, scope, read]): ResourceDefinition => ({
    uriTemplate: `pencil://${area}/{id}`, name: `Native ${area}`, mimeType: 'application/json', scope: `pencil:${scope}`, classes: ['standard'],
    classify(record) { return [{ class: 'standard', facts: { measure: record.json ? 1 : 0 } }] },
    async read(uri, ctx) {
      const match = new RegExp(`^pencil://${area}/([A-Za-z0-9_-]{1,256})$`).exec(uri)
      if (!match) return null
      try {
        const who = await nativeScope(db, services, ctx.person.id), json = await nativeCall(() => read(match[1], who.workspaceId))
        return json ? { json, untrusted: true } : null
      } catch (error) { if (error instanceof ToolRefusal && error.code === 'not_found') return null; throw error }
    },
  }))
}
