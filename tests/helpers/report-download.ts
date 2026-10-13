import type { LedgerFilter, LedgerResponse } from '../../src/core/features/reporting/repository'
import { startExport, exportPart } from '../../src/core/features/reporting/export'
type Snapshot = {cutoff:string;filter:LedgerFilter;excludedQuarantined:number;responses:LedgerResponse[]}
/** Collect only bounded synthetic test exports to assert the unchanged records. */
export async function fixtureExport(db: D1Database, workspaceId: string, flowId: string, filter: LedgerFilter): Promise<Snapshot> {
  const identity = {workspaceId,flowId,sessionId:'synthetic-export-session'}
  const secret = 'synthetic-export-test-key-never-used-in-production'
  const start = await startExport(db,secret,identity,filter,'json')
  let token: string|undefined = start.token, content = ''
  while (token) {
    const part = await exportPart(db,secret,identity,token,new AbortController().signal)
    content += await new Response(part.stream).text(); token = part.nextToken
  }
  return JSON.parse(content)
}
type DownloadResponse = {status:number|(()=>number);text():Promise<string>;headers:Headers|(()=>Record<string,string>)}
export async function httpExport<T = Snapshot>(request: (path:string)=>Promise<DownloadResponse>, path: string):Promise<T> {
  const [base,query=''] = path.split('?')
  const initial = await request(`${base}/start?${query}&format=json`)
  const status = (response: DownloadResponse) => typeof response.status === 'number' ? response.status : response.status()
  if (status(initial) !== 200) throw new Error(`Export start returned ${status(initial)}`)
  let token: string|undefined = JSON.parse(await initial.text()).token
  if (!token) throw new Error('Export start omitted its continuation')
  let content = ''
  while (token) {
    const part = await request(`${base}?token=${encodeURIComponent(token)}`)
    if (status(part) !== 200) throw new Error(`Export part returned ${status(part)}`)
    content += await part.text()
    token = typeof part.headers === 'function' ? part.headers()['x-export-next'] : part.headers.get('x-export-next') ?? undefined
  }
  return JSON.parse(content) as T
}
export async function allTexts(call: <T>(path:string)=>Promise<T>, path:string, revisionId:string, questionId:string) {
  const values:string[] = []; let cursor:string|undefined
  do {
    const page = await call<{texts:string[];cursor?:string}>(`${path}/questions/text?${new URLSearchParams({revisionId,questionId,search:'',...(cursor ? {cursor} : {})})}`)
    values.push(...page.texts); cursor = page.cursor
  } while(cursor)
  return values
}
