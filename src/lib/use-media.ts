import { useSyncExternalStore } from 'react'

/** True on laptop-width screens (Tailwind's lg breakpoint). */
export function useIsWide(query = '(min-width: 1024px)') {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query)
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
  )
}
