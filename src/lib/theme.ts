import { useSyncExternalStore } from 'react'

// Light / dark / follow the device. Saved per device (works on the lock screen too).
export type ThemeChoice = 'system' | 'light' | 'dark'
const KEY = 'hv-theme'
const media = window.matchMedia('(prefers-color-scheme: dark)')
const listeners = new Set<() => void>()

export function getTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

function resolved(choice = getTheme()): 'light' | 'dark' {
  return choice === 'system' ? (media.matches ? 'dark' : 'light') : choice
}

function apply() {
  const mode = resolved()
  document.documentElement.dataset.theme = mode
  document.documentElement.style.colorScheme = mode
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    m.removeAttribute('media')
    m.setAttribute('content', mode === 'dark' ? '#0B0D12' : '#F4F2EE')
  })
  listeners.forEach((l) => l())
}

export function setTheme(choice: ThemeChoice) {
  try {
    if (choice === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, choice)
  } catch {
    /* storage blocked: still apply for this session */
  }
  apply()
}

/** Flip between light and dark (from whatever is showing now). */
export function toggleTheme() {
  setTheme(resolved() === 'dark' ? 'light' : 'dark')
}

export function initTheme() {
  apply()
  media.addEventListener('change', () => getTheme() === 'system' && apply())
}

export function useTheme(): { choice: ThemeChoice; mode: 'light' | 'dark' } {
  const choice = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    getTheme,
  )
  return { choice, mode: resolved(choice) }
}
