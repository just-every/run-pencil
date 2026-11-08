import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { classify, sanitize } from './deployment-data-policy.mjs';

test('a populated agent door upgrades without losing history or restoring authority', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(readFileSync(new URL('../migrations/core/0074_agent_door.sql', import.meta.url), 'utf8'));
    db.exec(`
      INSERT INTO agent_door_state(id,envelope) VALUES(1,'{"business":"business-a"}');
      INSERT INTO agent_door_agents(id,name,sponsor,sponsor_name) VALUES('agent-a','Research','owner-a','Owner');
      INSERT INTO agent_door_calls VALUES('agent-a','key-a','digest-a','decision-a',100,'done','{"ok":true}');
      INSERT INTO agent_door_audit(id,at,agent,classes,row,evidence)
        VALUES('decision-a','2026-11-08T00:00:00Z','agent-a','[]','{"door":"mcp","consent":{}}','{"kept":true}');
      INSERT INTO agent_door_approvals(id,state,saved) VALUES('approval-a','pending','{"decision_id":"decision-a"}');
      INSERT INTO agent_door_reviews(id,state,saved) VALUES('review-a','open','{"decision_id":"decision-a"}');
      INSERT INTO agent_door_events(id,uri,event) VALUES('event-a','/research','{"kept":true}');
      INSERT INTO agent_door_usage VALUES('decision-a',100,'pencil',NULL,'agent-a','[]');
    `);
    const tables = db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name LIKE 'agent_door_%'").all().map(row => row.name);
    const before = new Map(tables.map(name => [name, db.prepare(`SELECT * FROM ${name}`).all()]));
    db.exec(readFileSync(new URL('../migrations/core/0077_agent_door_refresh.sql', import.meta.url), 'utf8'));
    for (const [name, rows] of before) {
      const columns = Object.keys(rows[0]);
      assert.deepEqual(db.prepare(`SELECT ${columns.join(',')} FROM ${name}`).all(), rows);
    }
    assert.equal(db.prepare('SELECT tombstone FROM agent_door_agents').get().tombstone, null);
    assert.equal(db.prepare('SELECT expires_at FROM agent_door_calls').get().expires_at, null);
    db.exec(`UPDATE agent_door_agents SET tombstone='2026-11-08T01:00:00Z';
      UPDATE agent_door_calls SET expires_at=200;
      INSERT INTO agent_door_retired_refs VALUES('retired-digest','{"at":"2026-11-08T01:00:00Z"}');
      UPDATE agent_door_audit SET evidence='{"updated":true}' WHERE id='decision-a';`);
    const relay = () => db.prepare('SELECT * FROM agent_door_relay').all();
    const initial = relay();
    assert.equal(initial.length, 1);
    assert.equal(initial[0].business, 'business-a');
    db.exec(`UPDATE agent_door_state SET envelope='{"business":"business-b"}';
      UPDATE agent_door_audit SET row='{"tombstone":{"at":"2026-11-08T01:00:00Z"}}' WHERE id='decision-a';
      UPDATE agent_door_approvals SET state='approved';
      UPDATE agent_door_reviews SET state='closed';`);
    assert.equal(relay().length, 1);
    assert.equal(relay()[0].business, 'business-a');
    assert.ok(relay()[0].sequence > initial[0].sequence);
    db.exec(`INSERT INTO agent_door_audit(id,at,agent,classes,row)
      VALUES('decision-b','2026-11-08T02:00:00Z','agent-a','[]','{"door":"mcp","consent":{}}');`);
    assert.equal(relay().find(row => row.decision_id === 'decision-b').business, 'business-b');
    for (const name of ['agent_door_agents', 'agent_door_calls', 'agent_door_relay', 'agent_door_retired_refs']) {
      const table = { name, columns: db.prepare(`PRAGMA table_info(${name})`).all().map(row => row.name), rows: [[{ type: 'text', value: 'private' }]] };
      assert.ok(Object.values(classify(table)).every(value => value === 'excluded-authorization'));
      assert.deepEqual(sanitize(table).rows, []);
    }
    assert.deepEqual(db.prepare('PRAGMA integrity_check').get(), Object.assign(Object.create(null), { integrity_check: 'ok' }));
  } finally {
    db.close();
  }
});
