import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { initialize, inventory } from './deployment-data-core.mjs';
import { classify, sanitize } from './deployment-data-policy.mjs';
import './deployment-data-custody-replay.check.mjs';
import './deployment-data-initialized.check.mjs';
import './deployment-data-preparation.check.mjs';

const custody = {
  ik_jobs: 'reversal_policy reversal_policy_hash reversal_cursor reversal_hash',
  ik_d1_creation_plans: 'job_id ordinal body released',
  ik_d1_reversal_reports: 'job_id effect_id position record_json',
  ik_d1_streams: 'id destination namespace mapping_version principal_id fingerprint operation_key total layout_hash state',
  ik_d1_stream_pages: 'stream_id ordinal job_id total erased_records',
  ik_d1_stream_origins: 'job_id stream_id ordinal page_total job_operation_key parent_destination parent_namespace parent_mapping_version parent_principal_id parent_fingerprint parent_operation_key parent_total parent_layout_hash',
  ik_d1_erased_sources: 'destination identity',
  ik_d1_erased_targets: 'destination identity',
  ik_d1_indexed_jobs: 'job_id fingerprint',
  ik_d1_plan_index: 'job_id ordinal source_identity target_identity',
  ik_d1_staging: 'id generation destination namespace mapping_version principal_id fingerprint operation_key total pages layout_hash reversal_policy revision registered_revision sealed_revision',
  ik_d1_staging_pages: 'stage_id ordinal job_id total fingerprint plan_json body_hash body_size chunks identities index_hash policy_hash inline_plan',
  ik_d1_staging_chunks: 'stage_id page_ordinal ordinal body body_hash body_size',
  ik_d1_staging_index: 'stage_id page_ordinal ordinal source_identity target_identity',
  ik_d1_staging_originals: 'stage_id original_key name sha256 size',
  ik_d1_preparation_receipts: 'stage_id generation codec_id header_hash header_size header_chunks',
  ik_d1_staging_headers: 'stage_id ordinal body body_hash body_size',
  ik_d1_publication_fences: 'stream_id job_id',
  ik_d1_custody_revisions: 'job_id revision seal',
  ik_d1_native_staging: 'id generation destination namespace mapping_version principal_id job_id fingerprint job_fence action values_count chunks_count identities revision registered_revision sealed_revision',
  ik_d1_native_staging_index: 'stage_id ordinal source_identity target_identity',
  ik_d1_native_staging_values: 'stage_id value_ordinal ordinal body body_hash body_size value_chunks',
  ik_d1_custody_states: 'job_id revision',
  form_import_native_clock: 'id revision',
  form_import_native_epochs: 'target_id revision seal',
  form_import_native_publication_fences: 'stage_id target_id',
};

test('[DATA-001,IMPORT-004] every migrated custody column is explicitly retained and future additions fail closed', () => {
  const database = new DatabaseSync(':memory:');
  try {
    initialize(database);
    const tables = inventory(database);
    for (const [name, expected] of Object.entries(custody)) {
      const table = tables.find(table => table.name === name);
      assert.ok(table, `Missing custody table: ${name}`);
      const columns = expected.split(' ');
      if (name === 'ik_jobs') assert.ok(columns.every(column => table.columns.includes(column)));
      else assert.deepEqual([...table.columns].sort(), [...columns].sort());
      const policy = classify(table);
      for (const column of columns) assert.equal(policy[column], 'retained');
      assert.throws(() => classify({ ...table, columns: [...table.columns, 'unreviewed_private_value'] }), { recoveryCode: 'UNCLASSIFIED_SCHEMA' });
    }
    assert.throws(() => classify({ name: 'ik_future_custody', columns: ['id'] }), { recoveryCode: 'UNCLASSIFIED_SCHEMA' });
  } finally { database.close(); }
});

test('[DATA-001,IMPORT-003,IMPORT-004] typed custody hashes and seals survive normalization while credentials and raw source bytes remain excluded', () => {
  const text = value => ({ type: 'text', value });
  const integer = value => ({ type: 'integer', value: String(value) });
  const sealed = { name: 'ik_d1_staging', columns: ['id','generation','revision','registered_revision','sealed_revision','layout_hash'],
    rows: [[text('private-stage'),text('generation'),integer(19),integer(19),integer(19),text('layout-integrity-hash')]] };
  const chunk = { name: 'ik_d1_staging_chunks', columns: ['stage_id','page_ordinal','ordinal','body','body_hash','body_size'],
    rows: [[text('private-stage'),integer(0),integer(0),text('safe normalized value\u0000😀'),text('body-integrity-hash'),integer(27)]] };
  for (const table of [sealed, chunk]) assert.deepEqual(sanitize(table), table);
  const jobs = sanitize({ name: 'ik_jobs', columns: ['id','reversal_policy_hash','reversal_hash','lease_token','lease_expires'],
    rows: [[text('job'),text('policy-integrity-hash'),text('reversal-integrity-hash'),text('synthetic-lease'),integer(99)]] });
  assert.deepEqual(jobs.rows[0].slice(1), [text('policy-integrity-hash'),text('reversal-integrity-hash'),{ type: 'null' },{ type: 'null' }]);
  for (const [name, column, expected] of [
    ['ik_originals','bytes',{ type: 'null' }],
    ['ik_stages','bytes',{ type: 'blob', value: '' }],
    ['ik_d1_original_chunks','bytes',{ type: 'blob', value: '' }],
    ['local_dev_inbox','magic_link_token',text('')],
    ['invitation_participants','token',{ type: 'null' }],
    ['invitation_participants','opt_out_token',{ type: 'null' }],
  ]) assert.deepEqual(sanitize({ name, columns: [column], rows: [[text('synthetic-private-source')]] }).rows, [[expected]]);
  for (const [name, column] of [['local_mail_outbox','message_json'],['rer_mail_development_outbox','message']]) {
    assert.deepEqual(sanitize({ name, columns: [column], rows: [[text('synthetic-private-capture')]] }).rows, []);
  }
  for (const [name, column] of [['responses','notification_eligible'],['response_outbox','notification_eligible'],['notification_deliveries','explicit_retry_authorized']]) {
    assert.deepEqual(sanitize({ name, columns: [column], rows: [[integer(1)]] }).rows, [[integer(0)]]);
  }
});
