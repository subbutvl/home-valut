import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * A single row that scrolls sideways. With `auto`, it drifts slowly like a news
 * ticker, pauses while touched or hovered (and for a few seconds after), and
 * goes back to the start at the end. Reduced-motion settings turn the drift off.
 */
export function ScrollRow({ children, auto, label, className }: { children: ReactNode; auto?: boolean; label: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !auto || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let pausedUntil = performance.now() + 2500
    let frame = 0
    let last = performance.now()
    let pos = el.scrollLeft
    const pause = (ms = 4000) => {
      pausedUntil = performance.now() + ms
    }
    const tick = (now: number) => {
      const dt = now - last
      last = now
      const max = el.scrollWidth - el.clientWidth
      if (max > 4 && now > pausedUntil && document.visibilityState === 'visible') {
        pos += dt * 0.03 // about 30 px a second
        if (pos >= max) {
          pos = 0
          pause(2500)
        }
        el.scrollLeft = pos
      } else pos = el.scrollLeft
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    const onUser = () => pause()
    el.addEventListener('pointerdown', onUser)
    el.addEventListener('wheel', onUser, { passive: true })
    el.addEventListener('touchstart', onUser, { passive: true })
    el.addEventListener('mouseenter', () => pause(60_000))
    el.addEventListener('mouseleave', () => pause(1500))
    el.addEventListener('focusin', () => pause(60_000))
    return () => {
      cancelAnimationFrame(frame)
      el.removeEventListener('pointerdown', onUser)
      el.removeEventListener('wheel', onUser)
      el.removeEventListener('touchstart', onUser)
    }
  }, [auto])
  return (
    <div
      ref={ref}
      role="list"
      aria-label={label}
      className={cn(
        '-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] lg:-mx-8 lg:px-8 [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {children}
    </div>
  )
}
