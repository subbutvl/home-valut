import { Moon, Sun } from 'lucide-react'
import { toggleTheme, useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'

/** One tap flips light and dark. */
export function ThemeToggle({ className }: { className?: string }) {
  const { mode } = useTheme()
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className={cn('flex size-11 shrink-0 items-center justify-center rounded-full border bg-card', className)}
    >
      {mode === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </button>
  )
}
