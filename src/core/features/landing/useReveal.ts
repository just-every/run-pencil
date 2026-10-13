import { useEffect, type RefObject } from 'react'

/**
 * Gentle reveal-on-scroll for every `[data-reveal]` element inside `root`. The server markup is fully visible; after
 * hydration, only elements still below the fold wait (`data-reveal="waiting"`) and are shown as they enter view, which
 * also draws their pencil circles. Reduced motion, or a browser without IntersectionObserver, keeps everything static.
 */
export function useReveal(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = root.current
    if (!element || typeof IntersectionObserver === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const waiting = Array.from(element.querySelectorAll<HTMLElement>('[data-reveal]'))
      .filter(target => target.getBoundingClientRect().top > window.innerHeight * 0.9)
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const target = entry.target as HTMLElement
        target.dataset.reveal = 'shown'
        observer.unobserve(target)
      }
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 })
    for (const target of waiting) {
      target.dataset.reveal = 'waiting'
      observer.observe(target)
    }
    return () => observer.disconnect()
  }, [root])
}
