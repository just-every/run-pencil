import { useEffect } from 'react'
/** A screen change moves keyboard and screen-reader reading position together. */
export function useRespondentFocus(screen:string|undefined,ready:boolean,id='respondent-title') {
  useEffect(()=>{
    if(ready) document.getElementById(id)?.focus()
  },[screen,ready,id])
}
