import { ChevronLeft, Copy, Eye, EyeOff, Star } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { copyText, useReveal } from '@/lib/secure-ui'
import { cn } from '@/lib/utils'

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-2xl border bg-card text-card-foreground', className)}>{children}</div>
}

/** True once the page has been scrolled (pages scroll the whole window). */
export function useScrolled(offset = 8) {
  const [scrolled, setScrolled] = useState(() => window.scrollY > offset)
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > offset)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [offset])
  return scrolled
}

/** Bar that stays at the top while the page scrolls. */
export function StickyBar({ children, className }: { children: ReactNode; className?: string }) {
  const stuck = useScrolled()
  return (
    <>
      <div
        className={cn(
          'sticky top-0 z-30 -mx-5 -mt-3 bg-background/95 px-5 pt-3 pb-2 backdrop-blur transition-shadow lg:-mx-8 lg:px-8',
          stuck && 'shadow-[0_1px_0_var(--border)]',
          className,
        )}
      >
        {children}
      </div>
    </>
  )
}

export function PageHeader({
  title,
  back,
  right,
  subtitle,
  stuckTitle,
}: {
  title: ReactNode
  back?: string | true
  right?: ReactNode
  subtitle?: ReactNode
  /** Shown in the bar once the page is scrolled, when the title itself is empty or long. */
  stuckTitle?: ReactNode
}) {
  const navigate = useNavigate()
  const stuck = useScrolled()
  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-30 -mx-5 -mt-3 flex min-h-14 items-center gap-1 bg-background/95 px-5 pt-3 pb-2 backdrop-blur transition-shadow lg:-mx-8 lg:px-8',
          stuck && 'shadow-[0_1px_0_var(--border)]',
        )}
      >
        {back && (
          <button
            type="button"
            aria-label="Back"
            onClick={() => (back === true ? navigate(-1) : navigate(back))}
            className="-ml-3 flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-muted"
          >
            <ChevronLeft className="size-6" />
          </button>
        )}
        <h1
          className={cn(
            'min-w-0 flex-1 leading-tight font-bold',
            stuck ? 'truncate text-[17px]' : 'line-clamp-2 text-[22px]',
          )}
        >
          {stuck && stuckTitle ? stuckTitle : title}
        </h1>
        {right}
      </header>
      {subtitle && <p className="-mt-3 text-[13px] text-muted-foreground">{subtitle}</p>}
    </>
  )
}

export function TileMark({ mark, className }: { mark: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-accent text-[14px] font-bold text-accent-foreground',
        className,
      )}
    >
      {mark}
    </span>
  )
}

export function FavStar({ on, className }: { on?: boolean; className?: string }) {
  return (
    <Star
      aria-hidden="true"
      className={cn('size-4', on ? 'fill-amber-400 stroke-amber-600' : 'stroke-muted-foreground', className)}
    />
  )
}

/** A label/value row with copy, and an eye button for secrets. */
export function ValueRow({
  label,
  value,
  display,
  secret,
  mono,
  hint,
}: {
  label: string
  value: string
  display?: ReactNode
  secret?: boolean
  mono?: boolean
  hint?: ReactNode
}) {
  const [shown, toggle] = useReveal()
  const onCopy = async () => {
    const ok = await copyText(value, secret)
    if (ok) toast.success(secret ? 'Copied. Clears from clipboard in 30 seconds' : 'Copied')
    else toast.error('Could not copy')
  }
  return (
    <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3 last:border-b-0">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={cn('text-base font-medium break-words whitespace-pre-wrap', (mono || secret) && 'font-mono')}>
          {secret && !shown ? '••••••••' : (display ?? value)}
        </span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {secret && (
        <button
          type="button"
          onClick={toggle}
          aria-label={shown ? `Hide ${label}` : `Show ${label}`}
          className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-muted text-foreground/80"
        >
          {shown ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
        </button>
      )}
      <button
        type="button"
        onClick={onCopy}
        aria-label={`Copy ${label}`}
        className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-muted text-foreground/80"
      >
        <Copy className="size-[18px]" />
      </button>
    </div>
  )
}

export function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean
  onClick?: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'h-9 shrink-0 rounded-full px-3.5 text-[13px] font-semibold',
        active ? 'bg-primary text-primary-foreground' : 'border border-input bg-card text-foreground',
      )}
    >
      {children}
    </button>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed px-6 py-10 text-center">
      <p className="text-[15px] font-semibold">{title}</p>
      {children && <div className="text-sm text-muted-foreground">{children}</div>}
    </div>
  )
}
