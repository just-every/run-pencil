import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect, test } from 'vitest'
import { pageStatement } from '../../scripts/deployment-data-page.mjs'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))

test('native D1 pages maximum-sized rows without materializing the complete candidate window', async () => {
  await env.DB.prepare('CREATE TABLE archive_wide_page_probe(value TEXT)').run()
  try {
    const value='x'.repeat(1_900_000)
    const insert=env.DB.prepare('WITH RECURSIVE numbers(n) AS (VALUES(1) UNION ALL SELECT n+1 FROM numbers WHERE n<10) INSERT INTO archive_wide_page_probe(value) SELECT ? FROM numbers').bind(value)
    for(let batch=0;batch<10;batch++)await insert.run()
    expect(await env.DB.prepare('SELECT count(*) rows,sum(length(value)) bytes FROM archive_wide_page_probe').first()).toEqual({rows:100,bytes:190_000_000})
    let cursor:string|undefined,seen=0
    for (;;) {
      const statement=pageStatement({name:'archive_wide_page_probe',columns:['value']},cursor)
      const page=(await env.DB.prepare(statement.sql).bind(...statement.params).all<{cursor:string;v0:string}>()).results
      if(!page.length)break
      expect(page.length).toBe(1)
      expect(JSON.parse(page[0].v0)).toBe(value)
      cursor=page[0].cursor;seen++
    }
    expect(seen).toBe(100)
  } finally {await env.DB.prepare('DROP TABLE archive_wide_page_probe').run()}
},60_000)
