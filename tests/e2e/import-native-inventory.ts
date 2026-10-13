import { DatabaseSync } from 'node:sqlite'
import { stateDatabaseFile } from './state-database'

/** Read the real browser-test database; never synthesize an import outcome. */
export function importNativeInventory() {
  const directory = process.env.PENCIL_MIGRATION_STATE!
  const database = new DatabaseSync(stateDatabaseFile(directory), { readOnly: true })
  try {
    const tables = [
      'flows', 'flow_revisions', 'flow_steps', 'choice_options', 'flow_branch_rules',
      'responses', 'response_answers', 'respondent_sessions', 'revision_metric_counters',
      'form_import_targets', 'form_import_revisions', 'form_import_native_epochs', 'form_import_native_publication_fences',
      'notification_preferences', 'response_outbox', 'notification_deliveries', 'notification_attempts',
      'ik_jobs', 'ik_d1_streams', 'ik_d1_stream_pages',
    ] as const
    const counts = Object.fromEntries(tables.map(table => [table, Number(database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get()!.count)]))
    const clock = database.prepare('SELECT id,revision FROM form_import_native_clock ORDER BY id').all()
    return { counts, clock }
  } finally { database.close() }
}
