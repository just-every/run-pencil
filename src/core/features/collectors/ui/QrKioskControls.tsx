import './qr.css'
import { useId, useState } from 'react'
import { collectorsPath } from './client'

export function QrKioskControls({flowId,collectorId,publicPath,label}:{flowId:string;collectorId?:string;publicPath:string;label:string}) {
  const id=useId(),[idle,setIdle]=useState(60)
  const qr=collectorId?`${collectorsPath(flowId)}/${encodeURIComponent(collectorId)}/qr`:`/api/app/flows/${encodeURIComponent(flowId)}/qr`
  const url=new URL(publicPath,location.origin)
  const kiosk=new URL(`/f/${url.pathname.split('/').pop()}`,location.origin)
  if(url.searchParams.has('collector'))kiosk.searchParams.set('collector',url.searchParams.get('collector')!)
  kiosk.searchParams.set('kiosk',String(idle))
  return <details className="qr-kiosk-controls"><summary>QR and kiosk · {label}</summary>
    <div className="builder-actions"><a className="quiet-button focus-ring" href={`${qr}?format=svg`} download>Download {label} QR (SVG)</a><a className="quiet-button focus-ring" href={`${qr}?format=png`} download>Download {label} QR (PNG)</a></div>
    {!publicPath.startsWith('/embed/') ? <details><summary>Kiosk for {label}</summary><p>For a shared device. Completed responses restart automatically. Leaving this tab or reaching the idle timeout clears unsent answers.</p><label className="inspector-field" htmlFor={id}>Clear idle answers after<select id={id} className="text-input" value={idle} onChange={event=>setIdle(Number(event.target.value))}><option value={10}>10 seconds</option><option value={30}>30 seconds</option><option value={60}>1 minute</option><option value={120}>2 minutes</option><option value={300}>5 minutes</option></select></label><a className="secondary-button focus-ring" href={kiosk.href} target="_blank" rel="noopener noreferrer">Open {label} kiosk</a></details> : null}
  </details>
}
