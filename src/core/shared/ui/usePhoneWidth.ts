import { useSyncExternalStore } from 'react'

const query = '(max-width: 620px)'
const subscribe = (notify: () => void) => { const media = window.matchMedia(query); media.addEventListener('change', notify); return () => media.removeEventListener('change', notify) }
/** True at phone width; the server render and the first paint assume the wider layout. */
export function usePhoneWidth() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false)
}
