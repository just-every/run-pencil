import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { initialize, inventory, readTable } from './deployment-data-core.mjs'
// Byte equality of every Base copy is recorded in base-copies.json and checked by `source:check`
// (edition-authoring verify-base). This script checks what the copies must still be to Pencil's own migrations.
const { preservedUndoEvolution } = await import('../src/base/import-kit/src/d1/evolutions/0001-preserved-undo.ts')
const { d1ErasureSchema } = await import('../src/base/import-kit/src/d1/erasure-schema.ts')
const { d1StreamOriginSchema } = await import('../src/base/import-kit/src/d1/stream-origin.ts')
const { d1StagingSchema, d1LegacyStreamReceiptUpgrade } = await import('../src/base/import-kit/src/d1/staging-schema.ts')
const { d1NativeStagingSchema } = await import('../src/base/import-kit/src/d1/native-staging-schema.ts')
const { d1CustodyStateSchema } = await import('../src/base/import-kit/src/d1/custody-state-schema.ts')
const { d1PreparationSchema } = await import('../src/base/import-kit/src/d1/preparation-schema.ts')
const { nativeImportStagingSchema } = await import('../src/core/features/importing/native-staging-schema.ts')
const { initializedRows } = await import('./deployment-data-initialized.mjs')
assert.ok(nativeImportStagingSchema.includes('INSERT OR IGNORE INTO form_import_native_clock(id,revision) VALUES(1,1)'))
assert.deepEqual(initializedRows.form_import_native_clock, { columns: ['id', 'revision'], rows: [[{ type: 'integer', value: '1' }, { type: 'integer', value: '1' }]] })
// Product migrations may add initialization; every declared baseline must
// still equal the actual installed rows, including Unicode's lookup tables.
const initialized = new DatabaseSync(':memory:')
try {
  initialize(initialized)
  const tables = inventory(initialized)
  for (const [name, expected] of Object.entries(initializedRows)) {
    const table = tables.find(table => table.name === name)
    assert.ok(table, `Initialized table ${name} is missing from the migrations.`)
    assert.deepEqual(readTable(initialized, table), { name, ...expected }, `Initialized table ${name} differs from its migration baseline.`)
  }
} finally { initialized.close() }
// Each export contains complete statements, including intact trigger bodies.
// Capture actual child origins before converting structurally proven stream receipts.
// d1StagingSchema already includes publication fences; do not append them twice.
const importMigration = [...preservedUndoEvolution, ...d1ErasureSchema, ...d1StreamOriginSchema, ...d1LegacyStreamReceiptUpgrade, ...d1StagingSchema, ...d1NativeStagingSchema, ...d1CustodyStateSchema, ...d1PreparationSchema, ...nativeImportStagingSchema].map(sql => `${sql};\n`).join('')
assert.ok((await readFile('migrations/core/0019_import_custody.sql')).equals(Buffer.from(importMigration)), 'Additive import migration differs from maintained SQL exports.')
// 0034 recreates 0019's publication-fence triggers in the form D1 parses, for databases that applied the earlier text.
const fenceTriggers = nativeImportStagingSchema.filter(sql => sql.includes("'IMPORT_NATIVE_PUBLICATION_CHANGED'"))
const triggerRepair = '-- The import publication-fence triggers of 0019, recreated in the form D1 parses. They behave as before.\n' + fenceTriggers.map(sql => `DROP TRIGGER IF EXISTS ${/TRIGGER IF NOT EXISTS (\S+)/.exec(sql)[1]};\n${sql};\n`).join('')
assert.ok((await readFile('migrations/core/0034_import_fence_triggers_d1.sql')).equals(Buffer.from(triggerRepair)), 'The trigger repair migration differs from the maintained trigger SQL.')
console.log('Pencil\'s additive import migration matches the maintained Base SQL exports.')
