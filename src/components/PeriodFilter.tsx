import { Calendar, Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { PeriodMode, PeriodValue } from '@/types'

const MONTHS_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
]

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const todayDate = () => new Date()
const todayIso = () => iso(todayDate())

function lastDayOfMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function monthRange(year: number, month: number) {
  return {
    startDate: `${year}-${pad(month)}-01`,
    endDate: `${year}-${pad(month)}-${pad(lastDayOfMonth(year, month))}`,
  }
}

function thisWeekRange() {
  const now = todayDate()
  const dow = now.getDay() || 7
  const monday = new Date(now)
  monday.setDate(now.getDate() - (dow - 1))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { startDate: iso(monday), endDate: iso(sunday) }
}

function parseYmd(s: string) {
  const [y, m, d] = String(s || '').split('-').map(Number)
  return { y, m, d }
}

function resolveRange(
  mode: PeriodMode,
  params: { monthValue: string; yearValue: number; customStart: string; customEnd: string },
) {
  switch (mode) {
    case 'today': {
      const t = todayIso()
      return { startDate: t, endDate: t }
    }
    case 'week':
      return thisWeekRange()
    case 'thisMonth': {
      const now = todayDate()
      return monthRange(now.getFullYear(), now.getMonth() + 1)
    }
    case 'monthly': {
      const { y, m } = parseYmd(`${params.monthValue}-01`)
      return monthRange(y, m)
    }
    case 'yearly': {
      const y = params.yearValue
      return { startDate: `${y}-01-01`, endDate: `${y}-12-31` }
    }
    case 'custom':
      return { startDate: params.customStart, endDate: params.customEnd }
    default: {
      const t = todayIso()
      return { startDate: t, endDate: t }
    }
  }
}

function fmtID(dateStr: string) {
  const { y, m, d } = parseYmd(dateStr)
  if (!y || !m || !d) return dateStr || ''
  return `${d} ${MONTHS_ID[m - 1]} ${y}`
}

export function fmtRangeLabel(startDate: string, endDate: string) {
  if (!startDate || !endDate) return ''
  if (startDate === endDate) return fmtID(startDate)
  const a = parseYmd(startDate)
  const b = parseYmd(endDate)
  const isFullYear = a.m === 1 && a.d === 1 && b.m === 12 && b.d === 31 && a.y === b.y
  if (isFullYear) return `Tahun ${a.y}`
  const isFullMonth =
    a.d === 1 && b.d === lastDayOfMonth(b.y, b.m) && a.y === b.y && a.m === b.m
  if (isFullMonth) return `${MONTHS_ID[a.m - 1]} ${a.y}`
  if (a.y === b.y && a.m === b.m) return `${a.d}–${b.d} ${MONTHS_ID[a.m - 1]} ${a.y}`
  return `${fmtID(startDate)} – ${fmtID(endDate)}`
}

function monthValueFromDate(dateStr?: string) {
  if (!dateStr) {
    const t = todayDate()
    return `${t.getFullYear()}-${pad(t.getMonth() + 1)}`
  }
  const { y, m } = parseYmd(dateStr)
  if (!y || !m) return monthValueFromDate()
  return `${y}-${pad(m)}`
}

function yearValueFromDate(dateStr?: string) {
  const { y } = parseYmd(dateStr || '')
  return y || todayDate().getFullYear()
}

function defaultYearRange(): [number, number] {
  const y = todayDate().getFullYear()
  return [y - 15, y + 5]
}

const LEFT_OPTIONS: Array<{ mode: PeriodMode; label: string } | { divider: true }> = [
  { mode: 'today', label: 'Hari Ini' },
  { mode: 'week', label: 'Minggu Ini' },
  { mode: 'thisMonth', label: 'Bulan Ini' },
  { divider: true },
  { mode: 'monthly', label: 'Bulanan' },
  { mode: 'yearly', label: 'Tahunan' },
  { divider: true },
  { mode: 'custom', label: 'Custom' },
]

export default function PeriodFilter({
  value,
  onChange,
  defaultMode = 'monthly',
  yearRange,
  className,
  align = 'start',
  'data-testid': testId = 'period-filter',
}: {
  value?: Partial<PeriodValue> | null
  onChange?: (next: PeriodValue) => void
  defaultMode?: PeriodMode
  yearRange?: [number, number]
  className?: string
  align?: 'start' | 'center' | 'end'
  'data-testid'?: string
}) {
  const [open, setOpen] = useState(false)
  const initialMode = value?.mode || defaultMode
  const [draftMode, setDraftMode] = useState<PeriodMode>(initialMode)
  const [monthValue, setMonthValue] = useState(
    initialMode === 'monthly' && value?.startDate
      ? monthValueFromDate(value.startDate)
      : monthValueFromDate(),
  )
  const [yearValue, setYearValue] = useState(
    initialMode === 'yearly' && value?.startDate
      ? yearValueFromDate(value.startDate)
      : todayDate().getFullYear(),
  )
  const [customStart, setCustomStart] = useState(value?.startDate || todayIso())
  const [customEnd, setCustomEnd] = useState(value?.endDate || todayIso())

  useEffect(() => {
    if (!open) return
    const mode = value?.mode || defaultMode
    setDraftMode(mode)
    if (value?.startDate) {
      setMonthValue(monthValueFromDate(value.startDate))
      setYearValue(yearValueFromDate(value.startDate))
      setCustomStart(value.startDate)
    }
    if (value?.endDate) setCustomEnd(value.endDate)
  }, [open, value, defaultMode])

  const [minYear, maxYear] = yearRange || defaultYearRange()
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i)

  const draftRange = resolveRange(draftMode, { monthValue, yearValue, customStart, customEnd })
  const draftLabel = fmtRangeLabel(draftRange.startDate, draftRange.endDate)

  const triggerLabel =
    value?.startDate && value?.endDate
      ? fmtRangeLabel(value.startDate, value.endDate)
      : 'Pilih periode'

  const apply = () => {
    onChange?.({
      mode: draftMode,
      startDate: draftRange.startDate,
      endDate: draftRange.endDate,
      label: draftLabel,
    })
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          data-testid={testId}
          className={cn('min-w-[200px] justify-between gap-2 font-normal', className)}
        >
          <span className="flex items-center gap-2 truncate">
            <Calendar className="size-4 shrink-0 text-primary" />
            <span className="truncate">{triggerLabel}</span>
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className="w-[min(92vw,34rem)] overflow-hidden rounded-2xl p-0"
        data-testid={`${testId}-panel`}
      >
        <div className="flex flex-col sm:flex-row">
          <div
            className="flex gap-1 overflow-x-auto border-b p-2 sm:w-40 sm:shrink-0 sm:flex-col sm:overflow-visible sm:border-r sm:border-b-0"
            style={{ borderColor: 'var(--legacy-border)' }}
          >
            {LEFT_OPTIONS.map((opt, i) =>
              'divider' in opt ? (
                <div
                  key={`div-${i}`}
                  className="my-1 hidden h-px shrink-0 sm:block"
                  style={{ background: 'var(--legacy-border)' }}
                />
              ) : (
                <button
                  key={opt.mode}
                  type="button"
                  data-testid={`${testId}-option-${opt.mode}`}
                  onClick={() => setDraftMode(opt.mode)}
                  className={cn(
                    'flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm whitespace-nowrap transition-colors sm:whitespace-normal',
                    draftMode === opt.mode
                      ? 'bg-primary/10 font-semibold text-primary'
                      : 'text-foreground hover:bg-accent',
                  )}
                >
                  {opt.label}
                  {draftMode === opt.mode && <Check className="size-3.5 shrink-0 text-primary" />}
                </button>
              ),
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-4 p-4">
            <div className="min-h-[64px] flex-1">
              {(draftMode === 'today' || draftMode === 'week' || draftMode === 'thisMonth') && (
                <div
                  className="rounded-xl px-3 py-3 text-sm"
                  style={{ background: 'var(--bg)', boxShadow: 'var(--shadow-inset)' }}
                  data-testid={`${testId}-preset-summary`}
                >
                  <p className="label mb-1">Rentang tanggal</p>
                  <p className="font-heading font-semibold">
                    {fmtRangeLabel(draftRange.startDate, draftRange.endDate)}
                  </p>
                </div>
              )}

              {draftMode === 'monthly' && (
                <div>
                  <label className="label">Pilih Bulan</label>
                  <Input
                    type="month"
                    value={monthValue}
                    onChange={(e) => setMonthValue(e.target.value)}
                    data-testid={`${testId}-month-input`}
                  />
                </div>
              )}

              {draftMode === 'yearly' && (
                <div>
                  <label className="label">Pilih Tahun</label>
                  <select
                    className="border-input bg-background h-9 w-full rounded-lg border px-3 text-sm"
                    value={String(yearValue)}
                    onChange={(e) => setYearValue(Number(e.target.value))}
                    data-testid={`${testId}-year-select`}
                  >
                    {years.map((y) => (
                      <option key={y} value={String(y)}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {draftMode === 'custom' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Dari</label>
                    <Input
                      type="date"
                      value={customStart}
                      max={customEnd || undefined}
                      onChange={(e) => setCustomStart(e.target.value)}
                      data-testid={`${testId}-custom-start`}
                    />
                  </div>
                  <div>
                    <label className="label">Sampai</label>
                    <Input
                      type="date"
                      value={customEnd}
                      min={customStart || undefined}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      data-testid={`${testId}-custom-end`}
                    />
                  </div>
                </div>
              )}
            </div>

            <div
              className="inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-2 text-xs"
              style={{
                background: 'var(--bg)',
                color: 'var(--primary-dark)',
                fontWeight: 600,
                boxShadow: 'var(--shadow-inset)',
              }}
              data-testid={`${testId}-summary`}
            >
              <Calendar className="size-3.5" /> {draftLabel}
            </div>

            <div
              className="flex justify-end gap-2 border-t pt-1"
              style={{ borderColor: 'var(--legacy-border)' }}
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
                data-testid={`${testId}-cancel`}
              >
                Batal
              </Button>
              <Button type="button" size="sm" onClick={apply} data-testid={`${testId}-apply`}>
                Terapkan
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export { resolveRange }
