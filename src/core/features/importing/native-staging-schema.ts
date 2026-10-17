/** Native mutation stamps fence every value observed before private staging.
 * Erasure removes the target stamp; the monotonic counter prevents ABA reuse. */
const selectors: Record<string, (ref: string) => string> = {
  flows: r => `SELECT ${r}.id AS target_id`,
  responses: r => `SELECT ${r}.id AS target_id`,
  flow_revisions: r => `SELECT ${r}.flow_id AS target_id`,
  flow_steps: r => `SELECT flow_id AS target_id FROM flow_revisions WHERE id=${r}.revision_id`,
  flow_branch_rules: r => `SELECT flow_id AS target_id FROM flow_revisions WHERE id=${r}.revision_id`,
  choice_options: r => `SELECT v.flow_id AS target_id FROM flow_steps s JOIN flow_revisions v ON v.id=s.revision_id WHERE s.id=${r}.step_id`,
  form_import_revisions: r => `SELECT ${r}.flow_id AS target_id`,
  notification_preferences: r => `SELECT ${r}.flow_id AS target_id`,
  submission_statuses: r => `SELECT ${r}.flow_id AS target_id`,
  submission_workflows: r => `SELECT ${r}.response_id AS target_id`,
  submission_tags: r => `SELECT ${r}.response_id AS target_id`,
  submission_notes: r => `SELECT ${r}.response_id AS target_id`,
  response_answers: r => `SELECT ${r}.response_id AS target_id`,
  response_outbox: r => `SELECT ${r}.response_id AS target_id`,
  notification_deliveries: r => `SELECT ${r}.response_id AS target_id`,
  notification_attempts: r => `SELECT response_id AS target_id FROM notification_deliveries WHERE id=${r}.delivery_id`,
  form_import_targets: r => `SELECT ${r}.target_id AS target_id`,
}
// D1 ends a trigger at its first `END;`, so a trigger body never closes a CASE right before a semicolon.
export const nativeImportStagingSchema = [
  'CREATE TABLE IF NOT EXISTS form_import_native_clock (id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL)',
  'INSERT OR IGNORE INTO form_import_native_clock(id,revision) VALUES(1,1)',
  'CREATE TABLE IF NOT EXISTS form_import_native_epochs (target_id TEXT PRIMARY KEY,revision INTEGER NOT NULL,seal TEXT)',
  'INSERT OR IGNORE INTO form_import_native_epochs(target_id,revision) SELECT target_id,(SELECT revision FROM form_import_native_clock WHERE id=1) FROM form_import_targets',
  'CREATE TABLE IF NOT EXISTS form_import_native_publication_fences (stage_id TEXT NOT NULL,target_id TEXT NOT NULL,PRIMARY KEY(stage_id,target_id))',
  'CREATE INDEX IF NOT EXISTS form_import_native_fence_target ON form_import_native_publication_fences(target_id)',
  'CREATE TRIGGER IF NOT EXISTS form_import_epoch_receipt_revision AFTER UPDATE OF revision ON form_import_native_epochs BEGIN UPDATE form_import_native_epochs SET seal=NULL WHERE target_id=NEW.target_id; END',
  ...['INSERT','UPDATE OF seal'].map(event => `CREATE TRIGGER IF NOT EXISTS form_import_epoch_receipt_${event.startsWith('INSERT')?'insert':'seal'} BEFORE ${event} ON form_import_native_epochs WHEN NEW.seal IS NOT NULL AND NOT EXISTS(SELECT 1 FROM form_import_native_publication_fences WHERE target_id=NEW.target_id AND stage_id=NEW.seal) BEGIN SELECT RAISE(ABORT,'IMPORT_NATIVE_RECEIPT_CHANGED'); END`),
  ...Object.entries(selectors).flatMap(([table, select]) => ['INSERT','UPDATE','DELETE'].map(event => {
    const ids = event === 'INSERT' ? select('NEW') : event === 'DELETE' ? select('OLD') : select('OLD')+' UNION '+select('NEW')
    const tracked = table === 'form_import_targets' ? `SELECT target_id FROM (${ids}) WHERE target_id IN (SELECT id FROM flows UNION ALL SELECT id FROM responses)` : `SELECT target_id FROM (${ids}) WHERE target_id IN (SELECT target_id FROM form_import_targets)`
    return `CREATE TRIGGER IF NOT EXISTS form_import_epoch_${table}_${event.toLowerCase()} BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'IMPORT_NATIVE_PUBLICATION_CHANGED') WHERE EXISTS(SELECT 1 FROM form_import_native_publication_fences WHERE target_id IN (${ids})); UPDATE form_import_native_clock SET revision=revision+1 WHERE id=1 AND EXISTS(${tracked}); INSERT INTO form_import_native_epochs(target_id,revision) SELECT target_id,(SELECT revision FROM form_import_native_clock WHERE id=1) FROM (${tracked}) WHERE 1 ON CONFLICT(target_id) DO UPDATE SET revision=excluded.revision; END`
  })),
  ...['flows','responses'].map(table => `CREATE TRIGGER IF NOT EXISTS form_import_epoch_${table}_erase AFTER DELETE ON ${table} BEGIN DELETE FROM form_import_native_epochs WHERE target_id=OLD.id; END`),
]
