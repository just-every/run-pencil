import { canonicalJson } from '../src/base/import-kit/src/d1/index.ts';
const sql = (sql, ...params) => ({ sql, params });
const decode = row => row && ({ destination: row.destination, targetKind: row.kind, targetId: row.id,
  revision: row.revision, value: JSON.parse(row.value_json), ...(row.attachment_json === null ? {} : { attachment: JSON.parse(row.attachment_json) }) });

// A test adapter over the kit's real SQL target table. Every observation and
// mutation reaches the database; it has no fabricated result or external effect.
export const custodyTargets = {
  async read(db, destination, kind, id) {
    return decode(await db.prepare('SELECT * FROM ik_targets WHERE destination=? AND kind=? AND id=?').bind(destination, kind, id).first());
  },
  matches(row, destination, kind, id) {
    return row ? sql('EXISTS(SELECT 1 FROM ik_targets WHERE destination=? AND kind=? AND id=? AND revision IS ? AND value_json IS ? AND attachment_json IS ?)',
      destination, kind, id, row.revision, canonicalJson(row.value), row.attachment ? canonicalJson(row.attachment) : null)
      : sql('NOT EXISTS(SELECT 1 FROM ik_targets WHERE destination=? AND kind=? AND id=?)', destination, kind, id);
  },
  matchesCount(count, destination) { return sql('(SELECT count(*) FROM ik_targets WHERE destination=?)=?', destination, count); },
  matchesMany(rows, destination) { return [this.matchesCount(rows.length, destination), ...rows.map(row => this.matches(row, destination, row.targetKind, row.targetId))]; },
  write(row) {
    return [sql('INSERT INTO ik_targets(destination,kind,id,revision,value_json,attachment_json) VALUES(?,?,?,?,?,?) ON CONFLICT(destination,kind,id) DO UPDATE SET revision=excluded.revision,value_json=excluded.value_json,attachment_json=excluded.attachment_json',
      row.destination, row.targetKind, row.targetId, row.revision, canonicalJson(row.value), row.attachment ? canonicalJson(row.attachment) : null)];
  },
  remove(destination, kind, id) { return [sql('DELETE FROM ik_targets WHERE destination=? AND kind=? AND id=?', destination, kind, id)]; },
  async list(db, destination) { return (await db.prepare('SELECT * FROM ik_targets WHERE destination=? ORDER BY kind,id').bind(destination).all()).results.map(decode); },
  async preparePreservedUndo(db, destination, effects) {
    const rows = await this.list(db, destination);
    return { nativeRows: rows, dependencies: [], guards: this.matchesMany(rows, destination), observations: effects.map(effect => ({
      effectId: effect.provenance.id, current: rows.find(row => row.targetId === effect.expected.targetId && row.targetKind === effect.expected.targetKind) ?? null,
      entity: { table: 'ik_targets', recordId: effect.expected.targetId },
      evidence: { observedTargets: rows.map(row => ({ targetId: row.targetId, value: row.value })) },
    })) };
  },
};

export async function custodyActor(database) {
  const actor = { id: crypto.randomUUID(), operatorId: crypto.randomUUID(), workspaceId: crypto.randomUUID() }, now = new Date().toISOString();
  await database.batch([
    database.prepare('INSERT INTO workspaces(id,name,time_zone,created_at,updated_at) VALUES(?,?,?,?,?)').bind(actor.workspaceId, 'Custody recovery', 'UTC', now, now),
    database.prepare('INSERT INTO operators(id,workspace_id,email,display_name,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(actor.operatorId, actor.workspaceId, `${actor.operatorId}@example.test`, 'Recovery operator', now, now),
  ]);
  await database.batch([database.prepare(`INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at)
    SELECT ?,?,a.id,a.version,'native',?,? FROM oa_operators a JOIN operator_auth_links l ON l.auth_id=a.id WHERE l.operator_id=?`)
    .bind(actor.id, crypto.randomUUID(), Date.now(), Date.now() + 3600000, actor.operatorId)]);
  return actor;
}

export function custodyContext(database, actor, namespace) {
  return { destination: actor.workspaceId, namespace, mappingVersion: 'custody-test-v1', batchSize: 1, maxBatches: 1,
    storage: { database, targets: custodyTargets }, authorization: { principalId: actor.operatorId,
      predicate: () => sql(`EXISTS(SELECT 1 FROM oa_sessions s JOIN oa_operators a ON a.id=s.operator_id
        JOIN operator_auth_links l ON l.auth_id=a.id JOIN operators o ON o.id=l.operator_id
        WHERE s.id=? AND o.id=? AND o.workspace_id=? AND s.kind='native' AND s.revoked_at IS NULL
          AND s.expires_at>unixepoch('subsec')*1000 AND s.operator_version=a.version AND a.status='active')`, actor.id, actor.operatorId, actor.workspaceId) } };
}
