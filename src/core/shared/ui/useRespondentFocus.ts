import { useEffect } from 'react'

let keyboard = false
let tracking = false
/** Whether the visitor last used the keyboard, the same cue :focus-visible uses for a script-moved focus. */
function trackInput() {
  if (tracking) return
  tracking = true
  window.addEventListener('keydown', () => { keyboard = true }, true)
  window.addEventListener('pointerdown', () => { keyboard = false }, true)
}

/** A screen change moves keyboard and screen-reader reading position together; the ring shows only for keyboard users. */
export function useRespondentFocus(screen:string|undefined,ready:boolean,id='respondent-title') {
  useEffect(()=>{
    trackInput()
    const heading = document.getElementById(id)
    if(!ready||!heading) return
    heading.toggleAttribute('data-quiet-focus', !keyboard)
    heading.focus()
  },[screen,ready,id])
}
