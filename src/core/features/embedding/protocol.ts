import { useEffect, useRef } from 'react'
import { challengePattern, checkoutHandoff, isEmbedAcknowledgement, type EmbedEvent } from './messages'

/** The server admits the parent origin; an opaque child only answers that parent. The returned function asks the host
 * page to open a Stripe Checkout page at top level (PAY-001); it does nothing until the host admitted this frame. */
export function useEmbedProtocol(embedded: boolean, completed: boolean, hostOrigin?: string) {
  const complete = useRef(completed)
  const notify = useRef<(() => void) | undefined>(undefined)
  const checkout = useRef<((handoff: {url:string;sessionId:string}) => boolean) | undefined>(undefined)
  const handedOff = useRef(new Set<string>())
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
      if (event.source !== window.parent || event.origin !== hostOrigin || !isEmbedAcknowledgement(event.data, challenge) || admitted) return
      admitted = true; measure()
    }
    notify.current = measure
    checkout.current = handoff => {
      if (!admitted) return false
      handedOff.current.add(handoff.sessionId)
      send({ type: 'pencil:checkout', challenge, url:handoff.url, sessionId:handoff.sessionId })
      return true
    }
    window.addEventListener('message', receive)
    send({ type: 'pencil:loaded', challenge })
    const observer = new ResizeObserver(measure)
    const main = document.querySelector('main[data-embedded="true"]')
    if (main) observer.observe(main)
    return () => { observer.disconnect(); window.removeEventListener('message', receive); notify.current = undefined; checkout.current = undefined }
  }, [embedded, hostOrigin])
  return (payment: unknown): 'sent' | 'duplicate' | 'unavailable' | 'invalid' => {
    const handoff = checkoutHandoff(payment)
    if (!handoff) return 'invalid'
    if (handedOff.current.has(handoff.sessionId)) return 'duplicate'
    return checkout.current?.(handoff) ? 'sent' : 'unavailable'
  }
}

/** Plain iframe snippets do not grant top navigation; their PAY-001 gap stays explicit. */
export function checkoutFallbackAvailable() {
  return window.parent === window || challengePattern.test(new URLSearchParams(window.location.hash.slice(1)).get('pencil-embed') ?? '')
}
