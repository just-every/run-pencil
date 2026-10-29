import { z } from 'zod'
import { defineTool, type JsonSchemaObject, type ToolContext, type ToolDefinition } from '../../../base/agent-door/index.ts'
import { ledgerFilterSchema } from '../../features/reporting/filter'
import { ResponseEdits } from '../../features/responses/edits'
import type { PencilServices } from '../services'
import { nativeCall, nativeScope } from './native'
import { identifier as id, objectSchema as schema, standard } from './form-context'

export function recordTools(db: D1Database, services: PencilServices): ToolDefinition[] {
  const scope = (ctx: ToolContext) => nativeScope(db, services, ctx.person.id)
  const read = (area: string, verb: string, title: string, clauses: string[], inputSchema: JsonSchemaObject, run: (args: Record<string, unknown>, who: Awaited<ReturnType<typeof scope>>) => Promise<unknown>): ToolDefinition => defineTool({
    name: `pencil.${area}.${verb}`, title, description: title, scope: `pencil:${area}`, readOnly: true, untrusted: true,
    classes: ['standard'], classify: standard, clauses, inputSchema, outputSchema: { type: 'object' },
    async run(args, ctx) {
      const result = await nativeCall(() => scope(ctx).then(who => run(args, who)))
      const key = area === 'analyses' ? verb === 'options' ? 'revisions' : 'runs' : area
      const rows = result && typeof result === 'object' ? (result as Record<string, unknown>)[key] : null
      const resourceArea = area === 'analyses' && verb === 'options' ? 'revisions' : area
      const resources = ['contacts', 'analyses', 'actions', 'revisions', 'deliveries'].includes(resourceArea) && Array.isArray(rows)
        ? rows.slice(0, 20).flatMap(row => {
          const id = row && typeof row === 'object' ? row[area === 'deliveries' ? 'deliveryId' : 'id'] : null
          return typeof id === 'string' ? [{ uri: `pencil://${resourceArea}/${encodeURIComponent(id)}`, name: `Native ${resourceArea}` }] : []
        }) : []
      return { result, resources }
    },
  })
  const form = schema({ formId: id }, ['formId'])
  return [
    read('contacts', 'list', 'List native audience contacts', ['DIST-003'], schema({ query: { type: 'string', maxLength: 500 }, offset: { type: 'integer', minimum: 0 }, limit: { type: 'integer', minimum: 1, maximum: 250 } }), async (args, who) => ({ contacts: await services.distribution.contacts.list(who.workspaceId, String(args.query ?? ''), Number(args.offset ?? 0), Number(args.limit ?? 250)) })),
    read('segments', 'list', 'Read saved audience segments and current counts', ['DIST-003'], schema({}), async (_args, who) => ({ segments: await services.distribution.segments.list(who.workspaceId) })),
    read('analyses', 'list', 'Read native analyses and provider usage', ['ANLY-001', 'ANLY-010'], schema({}), async (_args, who) => ({ runs: await services.analysis.records.list(who.workspaceId), usage: await services.analysis.records.usage(who.workspaceId) })),
    read('analyses', 'options', 'Read native revision and question eligibility for analysis', ['ANLY-002'], form, async (args, who) => services.analysis.options(who.workspaceId, String(args.formId))),
    read('actions', 'list', 'Read accountable actions and their current states', ['ACT-001', 'ACT-002'], schema({}), async (_args, who) => ({ actions: await services.actions.records.list(who.workspaceId) })),
    read('responses', 'list', 'Read the native response ledger under its filters', ['LEDG-001', 'LEDG-006'], schema({ formId: id, filter: z.toJSONSchema(ledgerFilterSchema, { io: 'input' }) }, ['formId']), async (args, who) => services.reporting.ledger(who.workspaceId, String(args.formId), ledgerFilterSchema.parse(args.filter ?? {}))),
    read('responses', 'versions', 'Read retained response versions', ['RESP-021'], schema({ responseId: id }, ['responseId']), async (args, who) => new ResponseEdits(db).versions(who.workspaceId, String(args.responseId))),
    read('responses', 'quarantine', 'Read native quarantined responses', ['RESP-016', 'RESP-017', 'RESP-018'], schema({ revisionId: id }, ['revisionId']), async (args, who) => ({ responses: await services.responses.listQuarantinedResponses({ workspaceId: who.workspaceId, revisionId: String(args.revisionId) }) })),
    read('results', 'questions', 'Read native question reports', ['RSLT-001'], schema({ formId: id, filter: z.toJSONSchema(ledgerFilterSchema, { io: 'input' }) }, ['formId']), async (args, who) => ({ questions: await services.reporting.questions(who.workspaceId, String(args.formId), undefined, ledgerFilterSchema.parse(args.filter ?? {})) })),
    read('results', 'compare', 'Read native revision comparisons', ['RSLT-005'], schema({ formId: id, offset: { type: 'integer', minimum: 0 } }, ['formId']), async (args, who) => services.reporting.compareRevisions(who.workspaceId, String(args.formId), Number(args.offset ?? 0))),
    read('deliveries', 'list', 'Read invitation and reminder delivery truth', ['DIST-004', 'DIST-008'], form, async (args, who) => ({ deliveries: await services.distribution.launches.list(who.workspaceId, String(args.formId)) })),
    read('collectors', 'list', 'Read current named collectors', ['DIST-017'], form, async (args, who) => ({ collectors: await services.collectors.list(who.workspaceId, String(args.formId)) })),
    read('settings', 'read', 'Read native workspace settings', ['WS-001', 'WS-002'], schema({}), async (_args, who) => ({ settings: await services.workspace.getSettings(who.workspaceId) })),
    read('operators', 'list', 'Read native equal operators', ['OPER-001'], schema({}), async (_args, who) => ({ operators: await services.auth.listOperators(who.workspaceId) })),
  ]
}
