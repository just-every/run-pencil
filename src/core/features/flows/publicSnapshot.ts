import { and, eq, getTableColumns, sql } from 'drizzle-orm'
import type { AnySQLiteTable } from 'drizzle-orm/sqlite-core'
import type { PencilDatabase } from '../../platform/db/repository'
import { choiceOptions, flowBranchRules, flowRevisions, flowSteps, flows, responses } from '../../platform/db/schema'

function rowJson(table: AnySQLiteTable) {
  return sql`json_object(${sql.join(Object.entries(getTableColumns(table)).map(([name, column]) => sql`${name}, ${column}`), sql`, `)})`
}

// Only SQL expressions and row decoders are shared; every call reads D1.
const snapshotFields = {
  flow: rowJson(flows).mapWith(value => JSON.parse(value) as typeof flows.$inferSelect),
  revision: sql`CASE WHEN ${flowRevisions.id} IS NOT NULL THEN ${rowJson(flowRevisions)} END`.mapWith(value => {
    if (value === null) return null
    const revision = JSON.parse(value) as typeof flowRevisions.$inferSelect
    return { ...revision, isCurrent: Boolean(revision.isCurrent) }
  }),
  completedResponses: sql<number>`CASE WHEN ${flowRevisions.targetCompletedResponses} IS NOT NULL THEN
    (SELECT COUNT(*) FROM ${responses} WHERE ${responses.revisionId} = ${flowRevisions.id} AND ${responses.state} = 'released') ELSE 0 END`,
  steps: sql`(SELECT json_group_array(json(item)) FROM (
    SELECT ${rowJson(flowSteps)} AS item FROM ${flowSteps}
    WHERE ${flowSteps.revisionId} = ${flowRevisions.id} ORDER BY ${flowSteps.position}
  ))`.mapWith(value => (JSON.parse(value) as Array<typeof flowSteps.$inferSelect>).map(step => ({ ...step, required: Boolean(step.required) }))),
  choices: sql`(SELECT json_group_array(json(item)) FROM (
    SELECT ${rowJson(choiceOptions)} AS item FROM ${choiceOptions}
    JOIN ${flowSteps} ON ${flowSteps.id} = ${choiceOptions.stepId}
    WHERE ${flowSteps.revisionId} = ${flowRevisions.id} ORDER BY ${choiceOptions.position}
  ))`.mapWith(value => JSON.parse(value) as Array<typeof choiceOptions.$inferSelect>),
  rules: sql`(SELECT json_group_array(json(item)) FROM (
    SELECT ${rowJson(flowBranchRules)} AS item FROM ${flowBranchRules}
    WHERE ${flowBranchRules.revisionId} = ${flowRevisions.id}
    ORDER BY ${flowBranchRules.sourceStepStableId}, ${flowBranchRules.position}
  ))`.mapWith(value => JSON.parse(value) as Array<typeof flowBranchRules.$inferSelect>),
}

export async function readCurrentPublicSnapshot(database: PencilDatabase, slug: string) {
  // A single SQL statement reads live publication, closure, target and graph
  // authority together. Ordered JSON subqueries avoid a Cartesian join of the
  // three collections, with no payload or admission cache across requests.
  return database.select(snapshotFields).from(flows)
    .leftJoin(flowRevisions, and(eq(flowRevisions.flowId, flows.id), eq(flowRevisions.state, 'published'), eq(flowRevisions.isCurrent, true)))
    .where(eq(flows.slug, slug)).limit(1).get()
}
