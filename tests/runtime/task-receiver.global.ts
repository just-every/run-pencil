// Test harness only: a loopback task system honouring the webhook contract in docs/guide/actions.md
// (create-or-get by idempotency key). Each behaviour is a deliberate network-edge fault; no live service.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { TestProject } from 'vitest/node'

type Mode = 'ok' | 'fail-once-500' | 'store-then-drop-once' | 'redirect'
type Captured = { path: string; authorization: string | null; idempotencyKey: string | null; contentType: string | null; body: string }

export default async function setup(project: TestProject) {
  let mode: Mode = 'ok', delayMilliseconds = 0
  let smsDrop=false,smsRefuse:number|null=null
  let chatDown=false,chatDrop=false
  const chatPosts=new Map<string,string>()
  let googleDown=false, googleTabs=1, googleBytes=0, googleDropWrite=false
  const sheetRows=new Map<string,string[][]>()
  const tasks = new Map<string, string>(), faulted = new Set<string>(), requests: Captured[] = []
  const read = (request: IncomingMessage) => new Promise<string>(resolve => { let body = ''; request.setEncoding('utf8'); request.on('data', chunk => { body += chunk }); request.on('end', () => resolve(body)) })
  const json = (response: ServerResponse, status: number, value: unknown) => { response.writeHead(status, { 'content-type': 'application/json' }); response.end(JSON.stringify(value)) }
  const server = createServer(async (request, response) => {
    const body = await read(request)
    if (request.url === '/__control/reset') { const options = JSON.parse(body || '{}'); mode = options.mode ?? 'ok'; delayMilliseconds = options.delayMilliseconds ?? 0; tasks.clear(); faulted.clear(); sheetRows.clear();googleDown=false;googleTabs=1;googleBytes=0;googleDropWrite=false;requests.length = 0;chatDown=false;chatDrop=false;chatPosts.clear();smsDrop=false;smsRefuse=null; return json(response, 200, { reset: true }) }
    if (request.url === '/__control/state') return json(response, 200, { tasks: Object.fromEntries(tasks), requests,chatPosts:Object.fromEntries(chatPosts),sheets:Object.fromEntries(sheetRows) })
    if(request.url==='/__control/sms-mode'){const options=JSON.parse(body);smsDrop=options.drop===true;smsRefuse=typeof options.refuse==='number'?options.refuse:null;return json(response,200,{configured:true})}
    if(request.url==='/__control/chat-mode'){const options=JSON.parse(body);chatDown=options.down===true;chatDrop=options.drop===true;return json(response,200,{down:chatDown})}
    if(request.url==='/__control/google-mode'){const options=JSON.parse(body);googleDown=options.down??false;googleTabs=options.tabs??1;googleBytes=options.bytes??0;googleDropWrite=options.dropWrite??false;if(options.book&&options.rows)sheetRows.set(options.book,options.rows);return json(response,200,{down:googleDown})}
    requests.push({ path: request.url ?? '', authorization: request.headers.authorization ?? null, idempotencyKey: (request.headers['idempotency-key'] as string | undefined) ?? null, contentType: request.headers['content-type'] ?? null, body })
    const url=new URL(request.url??'/',`http://127.0.0.1:${(server.address() as AddressInfo).port}`)
    if(url.pathname==='/chat.postMessage'||url.pathname==='/teams'){
      if(chatDown)return json(response,503,{ok:false})
      if(url.pathname==='/chat.postMessage'&&request.headers.authorization!=='Bearer synthetic-pencil-chat-bot')return json(response,401,{ok:false})
      const key=String(request.headers['idempotency-key']??'');if(!key)return json(response,400,{error:'missing-key'})
      chatPosts.set(key,chatPosts.get(key)??body)
      if(chatDrop){chatDrop=false;return request.socket.destroy()}
      return json(response,200,url.pathname==='/teams'?{accepted:true}:{ok:true,ts:'synthetic-pencil-1'})
    }
    if(url.pathname==='/o/oauth2/v2/auth'){const callback=new URL(url.searchParams.get('redirect_uri')!);callback.searchParams.set('state',url.searchParams.get('state')!);callback.searchParams.set('code','synthetic-pencil-google-code');response.writeHead(302,{location:callback.href});return response.end()}
    if(url.pathname==='/token')return json(response,200,{access_token:'synthetic-pencil-google-access',refresh_token:'synthetic-pencil-google-refresh',expires_in:3600,token_type:'Bearer'})
    if(url.pathname.startsWith('/v4/spreadsheets/')){
      if(googleDown)return json(response,503,{error:{message:'synthetic_unavailable'}})
      if(request.headers.authorization!=='Bearer synthetic-pencil-google-access')return json(response,401,{error:{message:'unauthorized'}})
      const match=/^\/v4\/spreadsheets\/([^/]+)(?:\/values\/(.*))?$/.exec(url.pathname)
      if(!match)return json(response,404,{error:{message:'missing-sheet'}})
      const book=match[1]
      if(!match[2]){
        const result={spreadsheetId:book,properties:{title:'Synthetic pencil workbook'},sheets:Array.from({length:googleTabs},(_,i)=>({properties:{sheetId:i+1,title:i?'Synthetic '+(i+1):'Synthetic responses'}}))}
        if(googleBytes){const text=JSON.stringify({...result,padding:''}),padded=text.slice(0,-2)+' '.repeat(Math.max(0,googleBytes-Buffer.byteLength(text)))+text.slice(-2);response.writeHead(200,{'content-type':'application/json'});return response.end(padded)}
        return json(response,200,result)
      }
      const range=decodeURIComponent(match[2]),rows=sheetRows.get(book)??[];sheetRows.set(book,rows)
      if(request.method==='GET')return json(response,200,{values:rows})
      const payload=JSON.parse(body||'{}'),row=/!A(\d+)/.exec(range)
      if(range.endsWith(':append'))rows.push(...payload.values)
      else if(range.endsWith(':clear')){if(row)rows[Number(row[1])-1]=[]}
      else if(request.method==='PUT'&&row)rows[Number(row[1])-1]=payload.values[0]
      else return json(response,400,{error:{message:'unsupported-write'}})
      if(googleDropWrite){googleDropWrite=false;return request.socket.destroy()}
      return json(response,200,{updatedRows:1})
    }
    if (/^\/2010-04-01\/Accounts\/[^/]+\/Messages\.json$/.test(request.url??'')){
      if(!request.headers.authorization?.startsWith('Basic '))return json(response,401,{error:'unauthorized'})
      const key=String(request.headers['idempotency-key']??'');if(!key)return json(response,400,{error:'missing-key'})
      if(smsRefuse!==null){const code=smsRefuse;smsRefuse=null;return json(response,400,{code,message:'synthetic-pencil refusal',status:400})}
      const sid=tasks.get(key)??`synthetic-pencil-${tasks.size+1}`;tasks.set(key,sid);if(smsDrop){smsDrop=false;return request.socket.destroy()}return json(response,201,{sid,status:'queued'})
    }
    if (request.url !== '/tasks') return json(response, 404, { error: 'not found' })
    if (mode === 'redirect') { response.writeHead(307, { location: '/redirected-tasks' }); return response.end() }
    if (delayMilliseconds) await new Promise(resolve => setTimeout(resolve, delayMilliseconds))
    const key = request.headers['idempotency-key'] as string | undefined
    if (!key || !request.headers.authorization?.startsWith('Bearer ')) return json(response, 401, { error: 'unauthorized' })
    if (mode === 'fail-once-500' && !faulted.has(key)) { faulted.add(key); return json(response, 500, { error: 'temporary' }) }
    const existing = tasks.get(key), taskId = existing ?? `task-${tasks.size + 1}`
    tasks.set(key, taskId)
    // The task is stored; the connection ends before any answer reaches Pencil.
    if (mode === 'store-then-drop-once' && !faulted.has(key)) { faulted.add(key); return request.socket.destroy() }
    return json(response, existing ? 200 : 201, { taskId })
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  project.provide('taskReceiverOrigin', `http://127.0.0.1:${(server.address() as AddressInfo).port}`)
  return () => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()) })
}

declare module 'vitest' {
  export interface ProvidedContext { taskReceiverOrigin: string }
}
