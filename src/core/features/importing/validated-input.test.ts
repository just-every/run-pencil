import { Hono } from 'hono'
import { z } from 'zod'
import { expect } from 'vitest'
import { contract } from '../../../test/contract'
import { validateInput } from '../../shared/validation'
import { validateImportInput } from './validated-input'

contract(['IMPORT-002', 'IMPORT-003'], 'native JSON reading preserves existing MIME, schema and malformed-body admission', async () => {
  const schema = z.object({ definition: z.string().min(1), csv: z.string(), columns: z.array(z.object({ column: z.number().int().nonnegative(), target: z.string() })).optional() })
  const existing = new Hono().post('/', validateInput('json', schema), c => c.json(c.req.valid('json')))
  const importing = new Hono().post('/', validateImportInput(schema), c => c.json(c.req.valid('json')))
  const valid = JSON.stringify({ definition: '漢😀\n"\\', csv: 'a,b\n1,0', columns: [{ column: 0, target: '__proto__' }], discarded: 'unreviewed extra field' })
  for (const [contentType, body] of [
    ['application/json', valid], ['application/vnd.example+json; charset=UTF-8', valid],
    ['text/plain', valid], ['', valid], ['application/json', '{malformed'],
    ['application/json', '{}'], ['application/json', 'null'], ['application/json', '[]'],
    ['application/json', '{"definition":"x","csv":"","columns":[{"column":-1,"target":"x"}]}'],
  ]) {
    const request = () => new Request('http://localhost/', { method: 'POST', headers: { 'Content-Type': contentType }, body })
    const before = await existing.request(request()), after = await importing.request(request())
    expect(after.status).toBe(before.status)
    expect(await after.text()).toBe(await before.text())
  }
});
