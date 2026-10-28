import { useSyncExternalStore } from 'react'

/** Layout mobile (frames de 360–390 px do Figma) abaixo de 768 px. */
const QUERY = '(max-width: 767px)'

function subscribe(cb: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener('change', cb)
  return () => mql.removeEventListener('change', cb)
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  )
}
