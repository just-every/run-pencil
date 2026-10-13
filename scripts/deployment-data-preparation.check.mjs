import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { initialize, inventory } from './deployment-data-core.mjs';
import { classify, sanitize } from './deployment-data-policy.mjs';

// Each new table has its own failure boundary, independent of migration checks.
const preparations = {
  ik_d1_preparation_receipts: ['stage_id', 'generation', 'codec_id', 'header_hash', 'header_size', 'header_chunks'],
  ik_d1_staging_headers: ['stage_id', 'ordinal', 'body', 'body_hash', 'body_size'],
};
for (const [name, columns] of Object.entries(preparations)) {
  test(`[DATA-001,IMPORT-003,IMPORT-004] ${name} retains only its exact reviewed columns`, () => {
    assert.deepEqual(classify({ name, columns }), Object.fromEntries(columns.map(column => [column, 'retained'])));
    for (const addition of ['unreviewed_private_value', 'token', 'bytes']) {
      assert.throws(() => classify({ name, columns: [...columns, addition] }), { recoveryCode: 'UNCLASSIFIED_SCHEMA' });
    }
    assert.throws(() => classify({ name: `${name}_future`, columns }), { recoveryCode: 'UNCLASSIFIED_SCHEMA' });
  });
  test(`[DATA-001,IMPORT-004] ${name} migration inventory and future schema coverage fail independently`, () => {
    const database = new DatabaseSync(':memory:');
    try {
      initialize(database);
      const table = inventory(database).find(table => table.name === name);
      assert.ok(table);
      assert.deepEqual(table.columns, columns);
      database.exec(`ALTER TABLE ${name} ADD COLUMN unreviewed_private_value TEXT`);
      assert.throws(() => classify(inventory(database).find(table => table.name === name)), { recoveryCode: 'UNCLASSIFIED_SCHEMA' });
    } finally { database.close(); }
  });
}
test('[DATA-001,IMPORT-003] private preparation values and nullable codec remain exact typed custody', () => {
  const text = value => ({ type: 'text', value });
  const integer = value => ({ type: 'integer', value: String(value) });
  const receipt = { name: 'ik_d1_preparation_receipts', columns: preparations.ik_d1_preparation_receipts,
    rows: [[text('stage'), text('generation'), { type: 'null' }, text('header-integrity-hash'), integer(31), integer(1)]] };
  const header = { name: 'ik_d1_staging_headers', columns: preparations.ik_d1_staging_headers,
    rows: [[text('stage'), integer(0), text('normalized header\u0000😀'), text('chunk-integrity-hash'), integer(23)]] };
  assert.deepEqual(sanitize(receipt), receipt);
  assert.deepEqual(sanitize(header), header);
});
