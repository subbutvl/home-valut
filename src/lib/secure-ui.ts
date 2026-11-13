import { useEffect, useRef, useState } from 'react'
import { lock } from './vault'

const HIDE_AFTER_MS = 30_000

/** Copy text; secrets are wiped from the clipboard after 30 seconds (best effort). */
export async function copyText(text: string, secret = false): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    return false
  }
  if (secret) {
    setTimeout(() => {
      // Reading the clipboard first would prompt on iPhone, so just overwrite it.
      navigator.clipboard.writeText("").catch(() => {
        /* page not focused: the browser refuses; nothing more we can do */
      })
    }, HIDE_AFTER_MS)
  }
  return true
}

/** A secret that hides itself again 30 seconds after being shown. */
export function useReveal(): [boolean, () => void] {
  const [shown, setShown] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const toggle = () => {
    window.clearTimeout(timer.current)
    setShown((s) => {
      if (!s) timer.current = window.setTimeout(() => setShown(false), HIDE_AFTER_MS)
      return !s
    })
  }
  return [shown, toggle]
}

const isPhone = () => window.matchMedia('(pointer: coarse)').matches

/**
 * Lock after `minutes` without activity, and straight away when the app goes
 * to the background on a phone.
 */
export function useAutoLock(enabled: boolean, minutes: number) {
  useEffect(() => {
    if (!enabled) return
    let last = Date.now()
    const bump = () => {
      last = Date.now()
    }
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const
    events.forEach((e) => window.addEventListener(e, bump, { passive: true, capture: true }))
    const tick = window.setInterval(() => {
      if (Date.now() - last > minutes * 60_000) lock()
    }, 5_000)
    const onVis = () => {
      if (document.visibilityState === 'hidden' && isPhone()) lock()
      // Timers pause in the background; check the idle time on return too.
      if (document.visibilityState === 'visible' && Date.now() - last > minutes * 60_000) lock()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      events.forEach((e) => window.removeEventListener(e, bump, { capture: true }))
      window.clearInterval(tick)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [enabled, minutes])
}
