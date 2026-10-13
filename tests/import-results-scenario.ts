import type { ScenarioCall } from './results-scenario'
import type { ImportReview } from '../src/core/features/importing/model'
import { formJson, csv, simpleJson, simpleCsv } from './fixtures/form-import/fixture'
export async function beginHistoricalScenario(call: ScenarioCall, large: boolean, title: string) {
  const input = { definition: JSON.stringify({ ...JSON.parse(large ? formJson : simpleJson), title }), csv: large ? csv : simpleCsv }
  const review = await call<ImportReview>('/api/app/imports/review', input)
  if (review.rowErrors.length) throw new Error('Historical scenario has invalid rows')
  let job = await call<{ id: string; state: string }>('/api/app/imports/commit', { ...input, plannedAt: review.plannedAt, columns: review.columns, fingerprint: review.fingerprint, acknowledged: true })
  // Preparation has no public form. Drive the real Continue action until the
  // scenario can inspect published import progress and reporting snapshots.
  while (job.state === 'preparing') job = await call(`/api/app/imports/${job.id}/resume`, {})
  const finish = async () => {
    while (job.state === 'applying') job = await call(`/api/app/imports/${job.id}/resume`, {})
    if (job.state !== 'completed') throw new Error('Historical scenario did not complete')
  }
  return { review, job, finish }
}
