import * as React from 'react'
import * as RechartsPrimitive from 'recharts'
import { cn } from '@/lib/utils'

export type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode
    color?: string
    icon?: React.ComponentType
  }
>

const ChartContext = React.createContext<{ config: ChartConfig } | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)
  if (!context) throw new Error('useChart must be used within a <ChartContainer />')
  return context
}

function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<'div'> & {
  config: ChartConfig
  children: React.ReactNode
}) {
  const uniqueId = React.useId()
  const chartId = `chart-${id || uniqueId.replace(/:/g, '')}`

  const colorConfig = Object.entries(config).filter(([, item]) => item.color)

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        data-chart={chartId}
        className={cn(
          'flex aspect-video justify-center text-xs',
          "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground",
          "[&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50",
          '[&_.recharts-curve.recharts-tooltip-cursor]:stroke-border',
          "[&_.recharts-dot[stroke='#fff']]:stroke-transparent",
          '[&_.recharts-layer]:outline-hidden',
          '[&_.recharts-sector]:outline-hidden',
          '[&_.recharts-surface]:outline-hidden',
          className,
        )}
        {...props}
      >
        {colorConfig.length > 0 && (
          <style
            dangerouslySetInnerHTML={{
              __html: `[data-chart=${chartId}] {\n${colorConfig
                .map(([key, item]) => `  --color-${key}: ${item.color};`)
                .join('\n')}\n}`,
            }}
          />
        )}
        <RechartsPrimitive.ResponsiveContainer width="99%" height="100%">
          {children as React.ReactElement}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
}

const ChartTooltip = RechartsPrimitive.Tooltip

type TooltipPayloadItem = {
  dataKey?: string | number
  name?: string
  value?: number | string
  color?: string
  payload?: Record<string, unknown>
}

function ChartTooltipContent({
  active,
  payload,
  className,
  formatter,
  label,
  hideLabel = false,
}: {
  active?: boolean
  payload?: TooltipPayloadItem[]
  className?: string
  label?: string
  hideLabel?: boolean
  formatter?: (value: number | string, name: string) => React.ReactNode
}) {
  const { config } = useChart()
  if (!active || !payload?.length) return null

  return (
    <div
      className={cn(
        'grid min-w-[8rem] items-start gap-1.5 rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl',
        className,
      )}
      style={{
        background: 'var(--surface, #fff)',
        borderColor: 'var(--legacy-border, #E3E8E6)',
        boxShadow: 'var(--shadow-soft, 0 1px 2px rgba(0,0,0,0.05))',
      }}
    >
      {!hideLabel && label ? <div className="font-medium">{label}</div> : null}
      <div className="grid gap-1.5">
        {payload.map((item, index) => {
          const key = String(item.name || item.dataKey || 'value')
          const itemConfig = config[key]
          return (
            <div key={String(item.dataKey ?? index)} className="flex w-full items-center gap-2">
              <div
                className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                style={{ backgroundColor: item.color }}
              />
              <div className="flex flex-1 justify-between gap-4 leading-none">
                <span className="text-muted-foreground">{itemConfig?.label || item.name}</span>
                {item.value !== undefined && (
                  <span className="font-mono font-medium tabular-nums text-foreground">
                    {formatter
                      ? formatter(item.value, String(item.name ?? ''))
                      : typeof item.value === 'number'
                        ? item.value.toLocaleString('id-ID')
                        : item.value}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const ChartLegend = RechartsPrimitive.Legend

function ChartLegendContent({
  className,
  payload,
  verticalAlign = 'bottom',
}: {
  className?: string
  payload?: Array<{ value?: string; color?: string; dataKey?: string | number }>
  verticalAlign?: 'top' | 'bottom'
}) {
  const { config } = useChart()
  if (!payload?.length) return null

  return (
    <div
      className={cn(
        'flex items-center justify-center gap-4',
        verticalAlign === 'top' ? 'pb-3' : 'pt-3',
        className,
      )}
    >
      {payload.map((item) => {
        const key = String(item.dataKey ?? item.value ?? '')
        const itemConfig = config[key]
        return (
          <div key={String(item.value)} className="flex items-center gap-1.5">
            <div
              className="h-2 w-2 shrink-0 rounded-[2px]"
              style={{ backgroundColor: item.color }}
            />
            {itemConfig?.label || item.value}
          </div>
        )
      })}
    </div>
  )
}

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
}
