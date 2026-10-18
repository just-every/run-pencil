import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'

const AnswerError = createContext<{id:string;message?:string}>({id:''})
/** Preserve a control's format/help association while attaching its question error. */
export function useAnswerAccessibility() {
  const error=useContext(AnswerError)
  return (describedBy?:string,invalid=false) => ({
    'aria-invalid': invalid || Boolean(error.message),
    'aria-describedby': [describedBy,error.message?error.id:''].filter(Boolean).join(' ') || undefined,
  })
}
export function AnswerFieldset({id,labelledBy,error,disabled,children}:{id:string;labelledBy:string;error?:string;disabled:boolean;children:ReactNode}) {
  const field=useRef<HTMLFieldSetElement>(null), errorId=`answer-error-${id}`
  useEffect(()=>{
    if(field.current?.closest('.screen-questions')?.querySelector('fieldset[aria-invalid="true"]') && field.current.closest('.screen-questions')?.querySelector('fieldset[aria-invalid="true"]')!==field.current)return
    if(error) field.current?.querySelector<HTMLElement>('input:not([type=hidden]), textarea, select, button[tabindex="0"], button:not([tabindex])')?.focus()
  },[error])
  return <AnswerError.Provider value={{id:errorId,message:error}}><fieldset ref={field} className="plain-fieldset" disabled={disabled} aria-labelledby={labelledBy} aria-invalid={Boolean(error)} aria-describedby={error?errorId:undefined}>
    {children}
    {error?<p id={errorId} className="status-note" data-tone="error" role="alert">{error}</p>:null}
  </fieldset></AnswerError.Provider>
}
