'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Theme = 'dark' | 'light'

const ThemeContext = createContext<{ theme: Theme; toggle: () => void; setTheme: (t: Theme) => void }>({
  theme: 'dark',
  toggle: () => {},
  setTheme: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')

  useEffect(() => {
    const saved = localStorage.getItem('ss-theme')
    const initial: Theme = saved === 'light' ? 'light' : 'dark'
    setThemeState(initial)
    document.documentElement.dataset.theme = initial
  }, [])

  function setTheme(next: Theme) {
    setThemeState(next)
    localStorage.setItem('ss-theme', next)
    document.documentElement.dataset.theme = next
  }

  function toggle() {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
