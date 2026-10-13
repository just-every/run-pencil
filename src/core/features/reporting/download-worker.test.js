import { afterEach, expect, vi } from 'vitest'
import { contract } from '../../../test/contract'
async function worker() {
  const handlers = new Map()
  const postMessage=vi.fn(),client={url:'https://pencil.example/app/results',postMessage}
  const self={location:{origin:'https://pencil.example'},clients:{matchAll:async()=>[client]},addEventListener:(name,handler)=>handlers.set(name,handler)}
  vi.resetModules();vi.stubGlobal('self',self)
  await import('./download-worker.js')
  const waits=[]
  const waitUntil=promise=>waits.push(promise)
  const start=()=>handlers.get('message')({source:client,data:{kind:'pencil-download-start',channel:'channel',flowId:'flow',token:'opaque',filename:'pencil-responses-flow.json'},ports:[{postMessage:vi.fn()}],waitUntil})
  const download=()=> {
    let response
    handlers.get('fetch')({request:new Request('https://pencil.example/app/exports/download?channel=channel'),respondWith:value=>{response=value},waitUntil})
    return response
  }
  return {start,download,postMessage,waits}
}
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals()})
contract(['LEDG-004','BASE-OPS-004'],'an abandoned download handshake reports failure and releases its worker lifetime',async()=> {
  vi.useFakeTimers();const f=await worker();f.start()
  expect(f.waits).toHaveLength(1)
  let settled=false;void f.waits[0].then(()=>{settled=true});await Promise.resolve();expect(settled).toBe(false)
  await vi.advanceTimersByTimeAsync(30000);await Promise.all(f.waits)
  expect(f.postMessage).toHaveBeenCalledWith(expect.objectContaining({channel:'channel',error:'Download could not start. Try again.'}))
  expect(f.download().status).toBe(400)
})
contract(['LEDG-004','BASE-OPS-004'],'a lost download channel reports failure to the initiating page',async()=> {
  const f=await worker();expect(f.download().status).toBe(400);await Promise.all(f.waits)
  expect(f.postMessage).toHaveBeenCalledWith(expect.objectContaining({channel:'channel',error:'Download could not start. Try again.'}))
})
contract(['LEDG-004','BASE-OPS-004'],'a claimed download releases its handshake and cancellation closes its stream lifetime',async()=> {
  vi.useFakeTimers();const f=await worker();f.start();const response=f.download()
  expect(response.status).toBe(200);expect(vi.getTimerCount()).toBe(0);await f.waits[0]
  await response.body.cancel();await Promise.all(f.waits)
  expect(f.postMessage).toHaveBeenCalledWith(expect.objectContaining({channel:'channel',error:'Download cancelled.'}))
})
