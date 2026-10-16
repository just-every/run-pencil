import { z } from 'zod'

export const backupBytes = 8 * 1024 * 1024
export const backupRows = 20_000
const cell = z.discriminatedUnion('type', [
  z.object({ type: z.literal('null') }).strict(),
  z.object({ type: z.literal('integer'), value: z.string().regex(/^-?(?:0|[1-9]\d*)$/) }).strict(),
  z.object({ type: z.literal('real'), value: z.number().finite() }).strict(),
  z.object({ type: z.literal('text'), value: z.string() }).strict(),
  z.object({ type: z.literal('blob'), value: z.string().regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/) }).strict(),
])
const table = z.object({ name: z.string(), columns: z.array(z.string()), rows: z.array(z.array(cell)) }).strict()
export const backupArchive = z.object({
  payload: z.object({
    format: z.literal('runeditrun/pencil-local-data.v1'),
    migrations: z.array(z.object({ name: z.string(), sha256: z.string() }).strict()),
    schema: z.string(), d1Migrations: table, tables: z.array(table),
  }).strict(), sha256: z.string().regex(/^[a-f0-9]{64}$/),
}).strict()
export type BackupCell = z.infer<typeof cell>
export type BackupTable = z.infer<typeof table>
export type BackupArchive = z.infer<typeof backupArchive>
export type BackupManifest = {
  schema: string
  migrations: {name: string; sha256: string}[]
  tables: {name: string; columns: string[]}[]
  foreignKeys: {from: string; to: string; columns: string[]; targetColumns: string[]}[]
}
export type BackupSummary = { sha256: string; tables: number; records: number; checked: 'contents-and-references'; restored: false }
export async function digest(value: unknown) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)))
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')
}
