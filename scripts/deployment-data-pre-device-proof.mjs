import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { withReleaseUpgradeInputs } from './release-upgrade-inputs.mjs';
import { importData, exportData, migrations } from './deployment-data.mjs';
import { migrateKit } from './deployment-data-hosted-test-helpers.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rows = (db, sql) => db.prepare(sql).all().map(row => ({ ...row }));
const responses = db => rows(db, 'SELECT id,revision_id,session_id,source,state,idempotency_key FROM responses ORDER BY id');
const answers = db => rows(db, 'SELECT id,response_id,step_id,value_json FROM response_answers ORDER BY id');
const links = db => rows(db, `SELECT a.id AS answer,r.id AS response,r.revision_id AS revision,s.stable_id AS step
  FROM response_answers a JOIN responses r ON r.id=a.response_id
  JOIN flow_steps s ON s.revision_id=r.revision_id AND s.stable_id=a.step_id ORDER BY a.id`);
const history = db => rows(db, 'SELECT * FROM d1_migrations ORDER BY id');
function restoredCustody(db) {
  for (const table of ['oa_sessions', 'oa_tokens']) assert.equal(rows(db, `SELECT * FROM ${table}`).length, 0, table);
  assert.deepEqual(rows(db, 'SELECT id,device_class,session_token_hash FROM respondent_sessions'), [
    { id: 'upgrade-active-session', device_class: 'mobile', session_token_hash: null },
  ]);
  assert.deepEqual(rows(db, 'SELECT id,session_token_hash,notification_eligible FROM responses ORDER BY id'), [
    { id: 'upgrade-response-1', session_token_hash: '', notification_eligible: 0 },
    { id: 'upgrade-response-2', session_token_hash: '', notification_eligible: 0 },
  ]);
  assert.deepEqual(rows(db, 'SELECT id,notification_eligible FROM response_outbox ORDER BY id'), [
    { id: 'upgrade-outbox-1', notification_eligible: 0 },
    { id: 'upgrade-outbox-2', notification_eligible: 0 },
  ]);
}
const integrity = db => {
  assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  assert.deepEqual(rows(db, 'PRAGMA foreign_key_check'), []);
};

function git(repository, ...args) {
  const result = spawnSync('git', args, { cwd: repository, maxBuffer: 32 * 1024 * 1024 });
  assert.equal(result.status, 0, 'Trusted predecessor source must be readable');
  return result.stdout;
}

// Resolve the declared release exactly as the native upgrade gate does. Never
// manufacture a predecessor by removing migrations from the current controller.
export async function preDeviceArchiveProof() {
  return withReleaseUpgradeInputs(root, async upgrade => {
    assert.equal(upgrade.firstRelease, undefined, 'Pre-device recovery needs a declared predecessor');
    const directory = mkdtempSync(join(process.env.PENCIL_VERIFICATION_TMPDIR ?? tmpdir(), 'pencil-pre-device-'));
    try {
      const { repository, commit } = upgrade.predecessor;
      const controller = join(directory, 'controller');
      mkdirSync(controller);
      const source = git(repository, 'archive', '--format=tar', commit, 'scripts', './migrations/core', 'package.json', 'pnpm-lock.yaml', 'RELEASE.json');
      const extracted = spawnSync('tar', ['-xf', '-', '-C', controller], { input: source });
      assert.equal(extracted.status, 0, 'Extract the pinned original controller without changing its bytes');
      assert.equal(JSON.parse(readFileSync(join(controller, 'RELEASE.json'))).version, upgrade.version);
      // The original archive modules use only Zod outside Node. Reuse it only
      // when it is the exact version in the predecessor's dependency lock.
      const lock = readFileSync(join(controller, 'pnpm-lock.yaml'), 'utf8');
      const zodVersion = lock.match(/^      zod:\n        specifier: [^\n]+\n        version: ([^\n]+)/m)?.[1];
      const require = createRequire(import.meta.url);
      assert.equal(JSON.parse(readFileSync(require.resolve('zod/package.json'))).version, zodVersion);
      symlinkSync(join(root, 'node_modules'), join(controller, 'node_modules'), 'dir');
      const original = await import(pathToFileURL(join(controller, 'scripts/deployment-data.mjs')));
      const { hashedLedger } = await import(pathToFileURL(join(controller, 'scripts/deployment-data-ledger.mjs')));
      const { testRestore } = await import(pathToFileURL(join(controller, 'scripts/deployment-data-restore-test.mjs')));
      const sourcePath = join(directory, 'historical.sqlite');
      const archive = join(directory, 'historical.rer');
      const targetPath = join(directory, 'restored.sqlite');
      let beforeResponses, beforeAnswers, beforeLinks, beforeHistory;
      const sourceDb = new DatabaseSync(sourcePath);
      try {
        original.initialize(sourceDb, hashedLedger);
        assert.equal(rows(sourceDb, 'PRAGMA table_info(responses)').some(row => row.name === 'device_class'), false);
        sourceDb.exec(readFileSync(upgrade.env.PENCIL_UPGRADE_FIXTURE_PATH, 'utf8'));
        integrity(sourceDb);
        beforeResponses = responses(sourceDb); beforeAnswers = answers(sourceDb);
        beforeLinks = links(sourceDb); beforeHistory = history(sourceDb);
        assert.deepEqual(beforeResponses.map(row => [row.id, row.revision_id, row.state]), [
          ['upgrade-response-1', 'upgrade-revision-1', 'released'],
          ['upgrade-response-2', 'upgrade-revision-2', 'quarantined'],
        ]);
        assert.deepEqual(beforeAnswers.map(row => [row.id, row.response_id, row.step_id, JSON.parse(row.value_json)]), [
          ['upgrade-answer-1', 'upgrade-response-1', 'upgrade-question', 'upgrade-choice-1'],
          ['upgrade-answer-2', 'upgrade-response-2', 'upgrade-question', 'upgrade-choice-2'],
        ]);
        assert.equal(beforeLinks.length, 2);
        assert.equal(beforeHistory.length, upgrade.migrationCount);
        assert.equal(rows(sourceDb, 'SELECT * FROM oa_sessions').length, 1);
        assert.equal(rows(sourceDb, 'SELECT * FROM oa_tokens').length, 1);
        assert.equal(rows(sourceDb, "SELECT * FROM respondent_sessions WHERE device_class='mobile'").length, 1);
      } finally { sourceDb.close(); }

      const exported = original.exportData(sourcePath, archive);
      const saved = readFileSync(archive);
      const payload = JSON.parse(saved).payload;
      assert.equal(payload.tables.find(table => table.name === 'responses').columns.includes('device_class'), false);
      for (const table of ['oa_sessions', 'oa_tokens']) {
        assert.deepEqual(payload.tables.find(entry => entry.name === table).rows, [], table);
      }
      // The current importer must still refuse this older inventory, leaving no
      // destination. The supported route uses the archive's trusted controller.
      const refused = join(directory, 'refused.sqlite');
      assert.throws(() => importData(archive, refused), { recoveryCode: 'INVENTORY_MISMATCH' });
      assert.throws(() => readFileSync(refused), { code: 'ENOENT' });
      const proof = testRestore(['--input', archive, '--output', targetPath]);
      assert.equal(proof.reexportSha256, exported.sha256);
      const reexport = join(directory, 'historical-again.rer');
      assert.deepEqual(original.exportData(targetPath, reexport), exported);
      assert.deepEqual(readFileSync(reexport), saved);

      const restored = new DatabaseSync(targetPath);
      try {
        integrity(restored);
        assert.deepEqual(responses(restored), beforeResponses);
        assert.deepEqual(answers(restored), beforeAnswers);
        assert.deepEqual(links(restored), beforeLinks);
        assert.deepEqual(history(restored), beforeHistory);
        restoredCustody(restored);
        // The installed deployment kit validates hashes and applies only trusted
        // current migrations. Archive schema text is never executed by this proof.
        const upgraded = await migrateKit(restored);
        assert.ok(upgraded.applied.length > 0);
        integrity(restored);
        assert.deepEqual(responses(restored), beforeResponses);
        assert.deepEqual(answers(restored), beforeAnswers);
        assert.deepEqual(links(restored), beforeLinks);
        assert.deepEqual(rows(restored, 'SELECT id,device_class FROM responses ORDER BY id'), [
          { id: 'upgrade-response-1', device_class: null },
          { id: 'upgrade-response-2', device_class: null },
        ]);
        assert.deepEqual(history(restored).slice(0, beforeHistory.length), beforeHistory);
        assert.deepEqual(history(restored).map(row => row.name), migrations().map(row => row.name));
        assert.deepEqual((await migrateKit(restored)).applied, []);
        restoredCustody(restored);
      } finally { restored.close(); }
      const currentArchive = join(directory, 'current.rer');
      exportData(targetPath, currentArchive);
      const current = JSON.parse(readFileSync(currentArchive)).payload.tables.find(table => table.name === 'responses');
      assert.equal(current.rows.length, beforeResponses.length);
      assert.deepEqual(current.rows.map(row => row[current.columns.indexOf('device_class')]), [{ type: 'null' }, { type: 'null' }]);
      assert.deepEqual(readFileSync(archive), saved, 'The original backup remains intact after the upgrade');
      console.log('Pre-device archive recovery:', JSON.stringify({ release: upgrade.version, sourceCommit: commit,
        originalMigrations: upgrade.migrationCount, archiveSha256: exported.sha256, exactReexport: true,
        responses: beforeResponses.length, answers: beforeAnswers.length, retainedLinks: beforeLinks.length,
        currentMigrations: migrations().length, historicalDeviceClasses: [null, null], currentImportRefused: true }));
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
}
