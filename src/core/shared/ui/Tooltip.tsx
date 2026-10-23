import { useId, useRef, useState, type ReactNode } from 'react'
import './tooltip.css'

/** Short labels for icon controls, including touch and keyboard access. */
export function Tooltip({label,children}:{label:string;children:ReactNode}) {
  const id=useId(),timer=useRef<ReturnType<typeof setTimeout>>(undefined)
  const [touch,setTouch]=useState(false)
  const clear=()=>{clearTimeout(timer.current);setTouch(false)}
  return <span className="control-tooltip" data-touch={touch||undefined} onPointerDown={event=>{if(event.pointerType==='touch')timer.current=setTimeout(()=>setTouch(true),300)}} onPointerUp={clear} onPointerCancel={clear} onPointerLeave={clear}>{children}<span id={id} className="control-tooltip-label" role="tooltip">{label}</span></span>
}
