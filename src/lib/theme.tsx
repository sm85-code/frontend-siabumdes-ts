import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

/** Appearance system ported from live frontend-siabumdes.
 * Defaults: Ripple wallpaper, Biru theme, Plus Jakarta Sans, light mode.
 */

export const FONTS = [
  { id: 'geist', label: 'Geist' },
  { id: 'inter', label: 'Inter' },
  { id: 'manrope', label: 'Manrope' },
  { id: 'jakarta', label: 'Plus Jakarta Sans' },
  { id: 'outfit', label: 'Outfit' },
  { id: 'grotesk', label: 'Space Grotesk' },
  { id: 'sora', label: 'Sora' },
  { id: 'mono', label: 'Geist Mono' },
] as const

export const THEMES = [
  { id: 'blue', label: 'Biru' },
  { id: 'zinc', label: 'Zinc (Monokrom)' },
  { id: 'red', label: 'Merah' },
  { id: 'orange', label: 'Oranye' },
  { id: 'yellow', label: 'Kuning' },
  { id: 'green', label: 'Hijau' },
  { id: 'violet', label: 'Violet' },
  { id: 'rose', label: 'Rose' },
] as const

export const BASE_COLORS = [
  { id: 'zinc', label: 'Zinc' },
  { id: 'slate', label: 'Slate' },
  { id: 'gray', label: 'Gray' },
  { id: 'neutral', label: 'Neutral' },
  { id: 'stone', label: 'Stone' },
] as const

export const MODES = [
  { id: 'light', label: 'Terang' },
  { id: 'dark', label: 'Gelap' },
] as const

export const WALLPAPERS = [
  { id: 'none', label: 'Polos' },
  { id: 'dots', label: 'Dot Grid' },
  { id: 'glow', label: 'Ripple' },
  { id: 'aurora', label: 'Aurora' },
] as const

export type FontId = (typeof FONTS)[number]['id']
export type ColorTheme = (typeof THEMES)[number]['id']
export type BaseColor = (typeof BASE_COLORS)[number]['id']
export type Mode = (typeof MODES)[number]['id']
export type WallpaperId = (typeof WALLPAPERS)[number]['id']

const FONT_KEY = 'bumdes-font'
const THEME_KEY = 'bumdes-theme'
const BASE_KEY = 'bumdes-base'
const WALLPAPER_KEY = 'bumdes-wallpaper'
const MODE_KEY = 'bumdes-mode'

const VALID_FONTS = FONTS.map((f) => f.id) as string[]
const VALID_THEMES = THEMES.map((t) => t.id) as string[]
const VALID_BASE_COLORS = BASE_COLORS.map((b) => b.id) as string[]
const VALID_WALLPAPERS = WALLPAPERS.map((w) => w.id) as string[]
const VALID_MODES = MODES.map((m) => m.id) as string[]

function readStored<T extends string>(key: string, validIds: string[], fallback: T): T {
  try {
    const stored = localStorage.getItem(key)
    return stored && validIds.includes(stored) ? (stored as T) : fallback
  } catch {
    return fallback
  }
}

interface ThemeContextValue {
  theme: 'modern'
  font: FontId
  setFont: (f: FontId) => void
  colorTheme: ColorTheme
  setColorTheme: (t: ColorTheme) => void
  baseColor: BaseColor
  setBaseColor: (b: BaseColor) => void
  wallpaper: WallpaperId
  setWallpaper: (w: WallpaperId) => void
  mode: Mode
  setMode: (m: Mode) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'modern',
  font: 'jakarta',
  setFont: () => {},
  colorTheme: 'blue',
  setColorTheme: () => {},
  baseColor: 'zinc',
  setBaseColor: () => {},
  wallpaper: 'glow',
  setWallpaper: () => {},
  mode: 'light',
  setMode: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [font, setFont] = useState<FontId>(() => readStored(FONT_KEY, VALID_FONTS, 'jakarta'))
  const [colorTheme, setColorTheme] = useState<ColorTheme>(() =>
    readStored(THEME_KEY, VALID_THEMES, 'blue'),
  )
  const [baseColor, setBaseColor] = useState<BaseColor>(() =>
    readStored(BASE_KEY, VALID_BASE_COLORS, 'zinc'),
  )
  const [wallpaper, setWallpaper] = useState<WallpaperId>(() =>
    readStored(WALLPAPER_KEY, VALID_WALLPAPERS, 'glow'),
  )
  const [mode, setMode] = useState<Mode>(() => readStored(MODE_KEY, VALID_MODES, 'light'))

  useEffect(() => {
    document.documentElement.setAttribute('data-font', font)
    try {
      localStorage.setItem(FONT_KEY, font)
    } catch {
      /* private mode */
    }
  }, [font])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', colorTheme)
    try {
      localStorage.setItem(THEME_KEY, colorTheme)
    } catch {
      /* private mode */
    }
  }, [colorTheme])

  useEffect(() => {
    document.documentElement.setAttribute('data-base', baseColor)
    try {
      localStorage.setItem(BASE_KEY, baseColor)
    } catch {
      /* private mode */
    }
  }, [baseColor])

  useEffect(() => {
    document.documentElement.setAttribute('data-wallpaper', wallpaper)
    try {
      localStorage.setItem(WALLPAPER_KEY, wallpaper)
    } catch {
      /* private mode */
    }
  }, [wallpaper])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', mode === 'dark')
    try {
      localStorage.setItem(MODE_KEY, mode)
    } catch {
      /* private mode */
    }
  }, [mode])

  return (
    <ThemeContext.Provider
      value={{
        theme: 'modern',
        font,
        setFont,
        colorTheme,
        setColorTheme,
        baseColor,
        setBaseColor,
        wallpaper,
        setWallpaper,
        mode,
        setMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
