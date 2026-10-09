import { Palette } from 'lucide-react'
import {
  BASE_COLORS,
  FONTS,
  MODES,
  THEMES,
  WALLPAPERS,
  useTheme,
  type BaseColor,
  type ColorTheme,
  type FontId,
  type Mode,
  type WallpaperId,
} from '@/lib/theme'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const selectClass =
  'h-9 w-full rounded-lg border border-input bg-popover text-popover-foreground px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

export default function AppearancePopover({
  triggerClassName,
  iconOnly = false,
  align = 'start',
}: {
  iconOnly?: boolean
  triggerClassName?: string
  align?: 'start' | 'center' | 'end'
}) {
  const { font, setFont, colorTheme, setColorTheme, baseColor, setBaseColor, wallpaper, setWallpaper, mode, setMode } =
    useTheme()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          data-testid="appearance-trigger"
          aria-label="Tampilan"
          title="Tampilan"
          variant="outline"
          size={iconOnly ? 'icon' : 'sm'}
          className={triggerClassName ?? 'gap-2'}
        >
          <Palette className="size-4" aria-hidden="true" />
          {!iconOnly && 'Tampilan'}
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-64 space-y-3" data-testid="appearance-popover">
        <div>
          <label className="label" htmlFor="theme-switcher">
            Tema
          </label>
          <select
            id="theme-switcher"
            data-testid="theme-switcher"
            className={selectClass}
            value={colorTheme}
            onChange={(e) => setColorTheme(e.target.value as ColorTheme)}
          >
            {THEMES.map((t) => (
              <option
                style={{ backgroundColor: 'var(--popover)', color: 'var(--popover-foreground)' }}
                key={t.id}
                value={t.id}
              >
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="base-color-switcher">
            Base Warna
          </label>
          <select
            id="base-color-switcher"
            data-testid="base-color-switcher"
            className={selectClass}
            value={baseColor}
            onChange={(e) => setBaseColor(e.target.value as BaseColor)}
          >
            {BASE_COLORS.map((b) => (
              <option
                style={{ backgroundColor: 'var(--popover)', color: 'var(--popover-foreground)' }}
                key={b.id}
                value={b.id}
              >
                {b.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="wallpaper-switcher">
            Wallpaper
          </label>
          <select
            id="wallpaper-switcher"
            data-testid="wallpaper-switcher"
            className={selectClass}
            value={wallpaper}
            onChange={(e) => setWallpaper(e.target.value as WallpaperId)}
          >
            {WALLPAPERS.map((w) => (
              <option
                style={{ backgroundColor: 'var(--popover)', color: 'var(--popover-foreground)' }}
                key={w.id}
                value={w.id}
              >
                {w.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="mode-switcher">
            Mode
          </label>
          <select
            id="mode-switcher"
            data-testid="mode-switcher"
            className={selectClass}
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode)}
          >
            {MODES.map((m) => (
              <option
                style={{ backgroundColor: 'var(--popover)', color: 'var(--popover-foreground)' }}
                key={m.id}
                value={m.id}
              >
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="font-switcher">
            Font
          </label>
          <select
            id="font-switcher"
            data-testid="font-switcher"
            className={selectClass}
            value={font}
            onChange={(e) => setFont(e.target.value as FontId)}
          >
            {FONTS.map((f) => (
              <option
                style={{ backgroundColor: 'var(--popover)', color: 'var(--popover-foreground)' }}
                key={f.id}
                value={f.id}
              >
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </PopoverContent>
    </Popover>
  )
}
