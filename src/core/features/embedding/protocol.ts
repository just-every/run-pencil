import { useEffect, useRef } from 'react'
import { challengePattern, isEmbedInit, type EmbedEvent } from './messages'

/** The server admits the parent origin; an opaque child only answers that parent. The returned function asks the host
 * page to open a Stripe Checkout page at top level (PAY-001); it does nothing until the host admitted this frame. */
export function useEmbedProtocol(embedded: boolean, completed: boolean, hostOrigin?: string) {
  const complete = useRef(completed)
  const notify = useRef<(() => void) | undefined>(undefined)
  const checkout = useRef<((url: string) => void) | undefined>(undefined)
  useEffect(() => { complete.current = completed; notify.current?.() }, [completed])
  useEffect(() => {
    if (!embedded || !hostOrigin || window.parent === window) return
    const challenge = new URLSearchParams(window.location.hash.slice(1)).get('pencil-embed') ?? ''
    if (!challengePattern.test(challenge)) return
    let admitted = false, sentComplete = false, lastHeight = 0
    const send = (data: EmbedEvent) => window.parent.postMessage(data, hostOrigin)
    const measure = () => {
      if (!admitted) return
      const main = document.querySelector('main[data-embedded="true"]')
      if (!main) return
      const height = Math.ceil(main.getBoundingClientRect().height)
      if (height > 0 && height <= 100000 && height !== lastHeight) { lastHeight = height; send({ type: 'pencil:height', challenge, height }) }
      if (complete.current && !sentComplete) { sentComplete = true; send({ type: 'pencil:completed', challenge }) }
    }
    const receive = (event: MessageEvent) => {
      if (event.source !== window.parent || event.origin !== hostOrigin || !isEmbedInit(event.data, challenge) || admitted) return
      admitted = true; measure()
    }
    notify.current = measure
    checkout.current = url => { if (admitted) send({ type: 'pencil:checkout', challenge, url }) }
    window.addEventListener('message', receive)
    send({ type: 'pencil:loaded', challenge })
    const observer = new ResizeObserver(measure)
    const main = document.querySelector('main[data-embedded="true"]')
    if (main) observer.observe(main)
    return () => { observer.disconnect(); window.removeEventListener('message', receive); notify.current = undefined; checkout.current = undefined }
  }, [embedded, hostOrigin])
  return (url: string) => checkout.current?.(url)
}
