'use client'

import { useTheme } from './ThemeProvider'
import { Icon } from './ui/Icon'

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const isLight = theme === 'light'

  return (
    <button
      type="button"
      onClick={toggle}
      title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      style={{
        width: 36,
        height: 36,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        background: 'var(--bg-2)',
        border: '1px solid var(--line)',
        color: 'var(--ink-2)',
      }}
    >
      <Icon name={isLight ? 'moon' : 'sun'} size={16} color="var(--ink-2)" />
    </button>
  )
}
