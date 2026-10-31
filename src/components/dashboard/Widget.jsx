import { useEffect, useState } from 'react'
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import api from '@/lib/api'
import Icon from '@/components/ui/Icons'
import MoneyValue from '@/components/ui/MoneyValue'
import usePrivacyStore from '@/store/privacyStore'
import useThemeColors from '@/hooks/useThemeColors'
import { formatCurrency } from '@/lib/format'
import { METRICS, FIXED_COLORS, isSimilarColor } from '@/config/dashboardCatalog'

const fmtValue = (unit, v) => unit === 'money' ? formatCurrency(v) : Number(v).toLocaleString('pt-BR')

function tickLabel(dimension, key) {
  if (dimension === 'dia') { const [, m, d] = key.split('-'); return `${d}/${m}` }
  if (dimension === 'mes') { const [y, m] = key.split('-'); return `${m}/${y.slice(2)}` }
  return key.length > 14 ? `${key.slice(0, 14)}…` : key
}

function resolveColor(color, theme) {
  if (!color || color === 'brand') return theme.brand
  return FIXED_COLORS[color] ?? color
}

function ChartTooltip({ active, payload, unit, dimension }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="bg-surface border border-line rounded-lg px-3 py-2 shadow-sm text-sm">
      <p className="text-ink-4 text-xs mb-1">{tickLabel(dimension, p.label)}</p>
      <p className="text-ink font-medium">{unit === 'money' ? <MoneyValue>{fmtValue(unit, p.value)}</MoneyValue> : fmtValue(unit, p.value)}</p>
    </div>
  )
}

function Chart({ type, result, color, theme, hidden, showLabels }) {
  const { data, unit, dimension } = result
  const timeline = dimension === 'dia' || dimension === 'mes'
  const tick = { fontSize: 10, fill: theme.ink4 }
  const yFmt = (v) => hidden && unit === 'money' ? '••••' : (unit === 'money' ? `R$${Number(v).toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })}` : v)
  const tooltip = <Tooltip content={<ChartTooltip unit={unit} dimension={dimension} />} />
  const xAxis = <XAxis dataKey="label" tickFormatter={(k) => tickLabel(dimension, k)} tick={tick} tickLine={false} axisLine={false} minTickGap={24} />
  const yAxis = <YAxis tickFormatter={yFmt} tick={tick} tickLine={false} axisLine={false} width={56} allowDecimals={unit === 'money'} />
  const grid = <CartesianGrid strokeDasharray="3 3" stroke={theme.line} vertical={false} />
  const margin = { top: 4, right: 8, bottom: 0, left: 0 }

  if (type === 'pizza') {
    // Fatias nunca repetem (nem parecem repetir) a cor principal escolhida
    const palette = [color, ...[...Object.values(FIXED_COLORS), theme.ink4, theme.ink2].filter((c) => !isSimilarColor(c, color))]
    return (
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="label" innerRadius="45%" outerRadius="80%" paddingAngle={2} stroke={theme.surface} label={showLabels ? ({ name }) => tickLabel(dimension, name) : false}>
          {data.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}
        </Pie>
        {tooltip}
      </PieChart>
    )
  }
  if (type === 'area') {
    return (
      <AreaChart data={data} margin={margin}>
        {grid}{xAxis}{yAxis}{tooltip}
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={color} fillOpacity={0.15} dot={false} activeDot={{ r: 4, fill: color }} />
      </AreaChart>
    )
  }
  if (type === 'linha') {
    return (
      <LineChart data={data} margin={margin}>
        {grid}{xAxis}{yAxis}{tooltip}
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={data.length <= 12} activeDot={{ r: 4, fill: color }} />
      </LineChart>
    )
  }
  // barra: colunas na linha do tempo, barras horizontais nos agrupamentos por categoria
  if (timeline) {
    return (
      <BarChart data={data} margin={margin}>
        {grid}{xAxis}{yAxis}{tooltip}
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} maxBarSize={28} label={showLabels ? { fontSize: 10, fill: theme.ink2, position: 'top' } : false} />
      </BarChart>
    )
  }
  return (
    <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke={theme.line} horizontal={false} />
      <XAxis type="number" tickFormatter={yFmt} tick={tick} tickLine={false} axisLine={false} allowDecimals={unit === 'money'} />
      <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: theme.ink2 }} tickLine={false} axisLine={false} width={110} tickFormatter={(k) => tickLabel(dimension, k)} />
      {tooltip}
      <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} maxBarSize={22} label={showLabels ? { fontSize: 10, fill: theme.ink2, position: 'right' } : false} />
    </BarChart>
  )
}

function DataTable({ result }) {
  const { data, unit, dimension } = result
  return (
    <div className="h-full overflow-auto scrollbar-hidden -mx-1">
      <table className="w-full text-sm">
        <tbody>
          {data.map((r) => (
            <tr key={r.key} className="border-b border-line-2 last:border-0">
              <td className="px-1 py-2 text-ink-2 text-[13px] truncate max-w-[160px]">{tickLabel(dimension, r.label)}</td>
              <td className="px-1 py-2 text-right font-mono text-[12.5px] text-ink">
                {unit === 'money' ? <MoneyValue>{fmtValue(unit, r.value)}</MoneyValue> : fmtValue(unit, r.value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Um widget do dashboard personalizado: busca os próprios dados (POST /dashboard/widget-data) e desenha por tipo.
// `query` é o do catálogo (metric/dimension/...); `period` ({ from, to }) é o filtro único da página, igual para todos.
// Só refaz a busca quando a consulta ou o período mudam (não ao mover/redimensionar). Sem período, fica no skeleton.
export default function Widget({ widget, period }) {
  const { type, title, query, style = {} } = widget
  const theme = useThemeColors()
  const hidden = usePrivacyStore((s) => s.hidden)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const queryKey = JSON.stringify(period ? { ...query, from: period.from, to: period.to } : null)

  useEffect(() => {
    let cancelled = false
    setResult(null); setError(null)
    const params = JSON.parse(queryKey)
    if (!params) return undefined
    api.post('/dashboard/widget-data', params)
      .then((res) => { if (!cancelled) setResult(res.data) })
      .catch((e) => { if (!cancelled) setError(e.response?.data?.error ?? 'Não foi possível carregar.') })
    return () => { cancelled = true }
  }, [queryKey])

  const def = METRICS[query.metric]
  const heading = title || def.label
  const color = resolveColor(style.color, theme)

  let body
  if (error) body = <p className="text-sm text-ink-4 text-center py-6">{Array.isArray(error) ? error[0] : error}</p>
  else if (!result) body = <div className="h-full min-h-[40px] rounded-lg bg-surface-2 animate-pulse" />
  else if (type === 'kpi') {
    body = (
      <div className="flex flex-col justify-center gap-2 h-full">
        <p className="text-[32px] font-serif font-light leading-none tracking-wide break-words" style={{ color }}>
          {def.unit === 'money' ? <MoneyValue>{fmtValue(def.unit, result.total)}</MoneyValue> : fmtValue(def.unit, result.total)}
        </p>
      </div>
    )
  } else if (result.data.length === 0 || result.data.every((d) => d.value === 0)) {
    body = <p className="text-sm text-ink-4 text-center py-6">Sem dados no período.</p>
  } else if (type === 'tabela') {
    body = <DataTable result={result} />
  } else {
    body = (
      <ResponsiveContainer width="100%" height="100%">
        {Chart({ type, result, color, theme, hidden, showLabels: style.labels })}
      </ResponsiveContainer>
    )
  }

  return (
    <div className="h-full min-w-0 bg-surface border border-line rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-display font-medium text-ink truncate min-w-0">{heading}</h3>
        {type === 'kpi' && <span className="p-1.5 rounded-lg bg-brand-soft shrink-0"><Icon name={def.icon} size={16} className="text-brand" /></span>}
      </div>
      <div className="flex-1 min-h-0">{body}</div>
    </div>
  )
}
