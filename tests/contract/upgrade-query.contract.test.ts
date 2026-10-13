import { DatabaseSync } from 'node:sqlite'
import { expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { boundedCompoundSelect } from '../helpers/compound-select'

contract('BASE-OPS-002', 'bounded upgrade queries preserve compound operators, quotes, comments, nested queries and global ordering with limits', () => {
  const database = new DatabaseSync(':memory:')
  try {
    const queries = [
      "SELECT 'UNION ALL; it''s quoted' AS value UNION ALL SELECT 'LIMIT' UNION ALL SELECT 'ORDER BY' UNION ALL SELECT 'EXCEPT' ORDER BY value DESC LIMIT 2 OFFSET 1",
      'SELECT 1 AS value UNION ALL SELECT 2 UNION SELECT 2 EXCEPT SELECT 1 UNION ALL SELECT 3 INTERSECT SELECT 3 ORDER BY value LIMIT 1',
      'SELECT (SELECT 9 UNION SELECT 3 ORDER BY 1 LIMIT 1) AS value UNION ALL SELECT 2 /* UNION ALL */ UNION ALL SELECT 1 -- ORDER BY hidden\n UNION ALL SELECT 4 ORDER BY 1 LIMIT 1, 2',
      'WITH "UNION" AS (SELECT 5 AS value UNION ALL SELECT 2) SELECT value FROM "UNION" UNION ALL SELECT 4 UNION ALL SELECT 1 UNION ALL SELECT 3 ORDER BY value LIMIT 3',
      'SELECT 2 AS "ORDER BY" UNION ALL SELECT 4 -- final term comment\n UNION ALL SELECT 1 UNION ALL SELECT 3 ORDER BY "ORDER BY" DESC LIMIT 2',
      'SELECT 1 AS [LIMIT] UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 ORDER BY [LIMIT]',
      "SELECT 'a' COLLATE NOCASE AS value UNION SELECT 'A' UNION SELECT 'b' UNION SELECT 'B' ORDER BY value",
      'SELECT 1+1 UNION ALL SELECT 3+1 UNION ALL SELECT 2+1 ORDER BY 1+1 LIMIT 2',
      'SELECT 1+1 AS first UNION ALL SELECT 3+1 AS second UNION ALL SELECT 2+1 AS third ORDER BY second DESC LIMIT 2',
      'WITH a AS (SELECT 1 AS value) SELECT * FROM a UNION ALL SELECT 3 UNION ALL SELECT 2 ORDER BY value DESC LIMIT 2',
      "SELECT 'a' AS first UNION ALL SELECT 'B' COLLATE NOCASE AS second UNION ALL SELECT 'c' AS third ORDER BY second",
    ]
    for (const query of queries) expect(database.prepare(boundedCompoundSelect(query, 2)).all(), query).toEqual(database.prepare(query).all())
    expect(() => boundedCompoundSelect('SELECT 1', 2, 2)).toThrow('byte budget')
  } finally { database.close() }
})

contract(['BASE-OPS-002', 'BASE-OPS-003'], 'fenced row queries retain every duplicate and apply ordering, limit and offset globally', () => {
  const database = new DatabaseSync(':memory:')
  try {
    database.exec('CREATE TABLE source(id INTEGER, value TEXT); INSERT INTO source VALUES (1,\'alpha\'),(2,\'beta\'),(3,NULL)')
    const compound = Array.from({ length: 31 }, (_, index) =>
      `SELECT ${index % 4} AS batch, json_object('id',id,'value',value) AS payload FROM source`).join('\nUNION /* preserve duplicates */ ALL\n')
    for (const suffix of ['', 'ORDER BY batch, payload LIMIT 17 OFFSET 9', 'ORDER BY 2 DESC, 1 LIMIT 9, 17', 'ORDER BY batch LIMIT 0']) {
      const original = `${compound}\n${suffix}`
      const bounded = boundedCompoundSelect(original)
      expect(bounded).not.toBe(original)
      expect(database.prepare(bounded).all()).toEqual(database.prepare(original).all())
    }
    expect(database.prepare(boundedCompoundSelect(compound)).all()).toHaveLength(93)
  } finally { database.close() }
})

contract('BASE-OPS-002', 'fenced union-all ordering retains later aliases, ordinal collations and quoted names', () => {
  const database = new DatabaseSync(':memory:')
  try {
    const collations = ['', ' COLLATE NOCASE', ' COLLATE RTRIM', ' COLLATE BINARY']
    for (const first of collations) for (const second of collations) for (const third of collations) {
      const compound = `SELECT 'a'${first} AS "first value" UNION ALL SELECT 'B'${second} AS [later value] UNION ALL SELECT 'a '${third} AS last_value UNION ALL SELECT NULL`
      for (const order of ['"first value"', '"later value"', '1', '1 COLLATE RTRIM DESC NULLS LAST']) {
        const original = `${compound} ORDER BY ${order} LIMIT 3 OFFSET 1`
        const bounded = boundedCompoundSelect(original, 2)
        expect(bounded).not.toBe(original)
        expect(database.prepare(bounded).all(), original).toEqual(database.prepare(original).all())
      }
    }
    const aliases = [
      'SELECT 1 first UNION ALL SELECT 4 `second` UNION ALL SELECT 2 third ORDER BY [second] DESC',
      'SELECT 1 AS "a""b" UNION ALL SELECT 3 UNION ALL SELECT 2 ORDER BY "a""b"',
      "SELECT 'a' value UNION ALL SELECT 'B' COLLATE NOCASE later UNION ALL SELECT 'c' ORDER BY later",
      'SELECT 1 AS value -- UNION ALL SELECT hidden\n UNION /* ALL */ ALL SELECT 3 UNION ALL SELECT 2 ORDER BY value;',
    ]
    for (const original of aliases) {
      const bounded = boundedCompoundSelect(original, 2)
      expect(bounded).not.toBe(original)
      expect(database.prepare(bounded).all(), original).toEqual(database.prepare(original).all())
    }
  } finally { database.close() }
})

contract('BASE-OPS-002', 'queries requiring SQLite metadata or set comparison remain unchanged for native execution', () => {
  const database = new DatabaseSync(':memory:')
  try {
    database.exec("CREATE TABLE labels(value TEXT COLLATE NOCASE); INSERT INTO labels VALUES ('A')")
    const queries = [
      "SELECT 'a' AS value UNION ALL SELECT value FROM labels UNION ALL SELECT 'B' ORDER BY value",
      "SELECT 'a' AS value INTERSECT SELECT 'A' UNION ALL SELECT 'b' UNION SELECT 'B' COLLATE NOCASE ORDER BY value",
      'SELECT 1 value UNION ALL SELECT 2 EXCEPT SELECT 1 UNION ALL SELECT 3 ORDER BY value',
      'SELECT 1 AS repeated, 2 AS repeated UNION ALL SELECT 3,4 UNION ALL SELECT 5,6 ORDER BY 1',
      'SELECT * FROM labels UNION ALL SELECT \'b\' UNION ALL SELECT \'c\' ORDER BY value',
      'SELECT (SELECT 1 UNION SELECT 2 LIMIT 1) AS value UNION ALL SELECT 3 UNION ALL SELECT 4 ORDER BY value',
      'SELECT CAST(value AS TEXT) AS value FROM labels UNION ALL SELECT \'b\' UNION ALL SELECT \'c\' ORDER BY value',
      'SELECT 1+1 AS value UNION ALL SELECT 3 UNION ALL SELECT 4 ORDER BY (1+1)',
    ]
    for (const original of queries) {
      expect(boundedCompoundSelect(original, 2)).toBe(original)
      expect(database.prepare(boundedCompoundSelect(original, 2)).all()).toEqual(database.prepare(original).all())
    }
  } finally { database.close() }
})

contract('BASE-OPS-002', 'fenced queries preserve CTE scope and reject SQL growth beyond the byte budget', () => {
  const database = new DatabaseSync(':memory:')
  try {
    const query = `/* SELECT UNION */ WITH "source" AS (SELECT 7 AS value)
      SELECT json_object('value',value) AS "row" FROM "source"
      UNION ALL SELECT json_object('value',9) UNION ALL SELECT json_object('value',8)
      ORDER BY "row" LIMIT 1 OFFSET 1`
    expect(boundedCompoundSelect(query, 2)).not.toBe(query)
    expect(database.prepare(boundedCompoundSelect(query, 2)).all()).toEqual(database.prepare(query).all())
    expect(() => boundedCompoundSelect(query, 2, new TextEncoder().encode(query).length)).toThrow('byte budget')
    expect(() => boundedCompoundSelect(query, 1)).toThrow('At least two')
    expect(() => boundedCompoundSelect(query, 2.5)).toThrow('At least two')
  } finally { database.close() }
})
