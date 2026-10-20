// Test harness only: a loopback edge that reads exported XLSX and SAV bytes with published, independent
// readers (read-excel-file and sav-reader) in Node, so the Worker test checks Pencil's writers against code they share nothing with.
import { createServer, type IncomingMessage } from 'node:http'
import type { AddressInfo } from 'node:net'
import readXlsxFile from 'read-excel-file/node'
import { createRequire } from 'node:module'
import type * as SavReaderModule from 'sav-reader'
import type { TestProject } from 'vitest/node'

// sav-reader publishes only a CommonJS entry.
const { SavBufferReader } = createRequire(import.meta.url)('sav-reader') as typeof SavReaderModule
const body = (request: IncomingMessage) => new Promise<Buffer>(resolve => { const chunks: Buffer[] = []; request.on('data', chunk => chunks.push(chunk)); request.on('end', () => resolve(Buffer.concat(chunks))) })

async function readXlsx(bytes: Buffer) {
  return { sheets: (await readXlsxFile(bytes)).map(sheet => ({ name: sheet.sheet, rows: sheet.data })) }
}

async function readSav(bytes: Buffer) {
  const reader = new SavBufferReader(bytes)
  await reader.open()
  const rows = await reader.readAllRows(true)
  return { header: { n_cases: reader.meta.header.n_cases, encoding: reader.meta.header.encoding }, variables: reader.meta.sysvars.map(variable => ({ name: variable.name, label: variable.label, type: variable.type })), valueLabels: reader.meta.valueLabels.map(set => ({ appliesTo: set.appliesToNames, entries: set.entries })), rows }
}

export default async function setup(project: TestProject) {
  const server = createServer(async (request, response) => {
    try {
      const bytes = await body(request)
      const result = request.url === '/xlsx' ? await readXlsx(bytes) : request.url === '/sav' ? await readSav(bytes) : undefined
      response.writeHead(result ? 200 : 404, { 'content-type': 'application/json' }); response.end(JSON.stringify(result ?? { error: 'unknown reader' }))
    } catch (error) { response.writeHead(422, { 'content-type': 'application/json' }); response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) })) }
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  project.provide('exportReaderOrigin', `http://127.0.0.1:${(server.address() as AddressInfo).port}`)
  return () => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()) })
}

declare module 'vitest' {
  export interface ProvidedContext { exportReaderOrigin: string }
}
