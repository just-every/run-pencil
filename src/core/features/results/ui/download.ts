import { reportingApi, type LedgerFilter } from '../../../app/api'
export async function downloadResponses(flowId: string, filter: LedgerFilter, format: 'json'|'csv') {
  if (!('serviceWorker' in navigator)) throw new Error('Streamed downloads require a browser with service workers on HTTPS or localhost.')
  const registration = await navigator.serviceWorker.register('/api/app/export-worker.js',{scope:'/app/exports/'})
  const worker = registration.installing ?? registration.waiting ?? registration.active
  if (!worker) throw new Error('The download worker could not start.')
  if (worker.state !== 'activated') await new Promise<void>((resolve,reject)=> {
    worker.addEventListener('statechange',()=> { if (worker.state === 'activated') resolve(); if (worker.state === 'redundant') reject(new Error('The download worker could not start.')) })
  })
  const start = await reportingApi.startExport(flowId,filter,format)
  const channel = crypto.randomUUID()
  await new Promise<void>((resolve) => {
    const ports = new MessageChannel()
    ports.port1.onmessage = () => { ports.port1.close(); resolve() }
    worker.postMessage({kind:'pencil-download-start',channel,flowId,token:start.token,filename:start.filename},[ports.port2])
  })
  return new Promise<typeof start>((resolve,reject)=> {
    const frame = document.createElement('iframe')
    frame.hidden = true
    const listener = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.data?.kind !== 'pencil-export' || event.data?.channel !== channel) return
      if (event.data.complete || event.data.error) {
        navigator.serviceWorker.removeEventListener('message',listener)
        frame.remove()
        if (event.data.error) reject(new Error(event.data.error))
        else if (event.data.written !== start.total) reject(new Error('The complete response set was not downloaded.'))
        else resolve(start)
      }
    }
    navigator.serviceWorker.addEventListener('message',listener)
    // Navigate into the worker's scope from the uncontrolled Results page.
    // Content-Disposition hands its stream directly to the download manager.
    frame.src = `/app/exports/download?${new URLSearchParams({channel})}`
    document.body.appendChild(frame)
  })
}
