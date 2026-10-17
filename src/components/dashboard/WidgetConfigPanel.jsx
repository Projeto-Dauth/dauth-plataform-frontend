import Icon from '@/components/ui/Icons'
import Button from '@/components/ui/Button'
import useThemeColors from '@/hooks/useThemeColors'
import { METRICS, DIMENSIONS, WIDGET_TYPES, FIXED_COLORS, isSimilarColor } from '@/config/dashboardCatalog'

const COLORS = [
  { id: 'brand', label: 'Cor do tema', css: 'rgb(var(--brand))' },
  { id: 'gold', label: 'Dourado', css: FIXED_COLORS.gold },
  { id: 'success', label: 'Verde', css: FIXED_COLORS.success },
  { id: 'danger', label: 'Vermelho', css: FIXED_COLORS.danger },
]

const fieldClass = 'h-[38px] w-full px-3 rounded-lg border border-line bg-surface text-ink text-[13.5px] focus:outline-none focus:border-brand cursor-pointer'
const labelClass = 'block text-xs font-mono uppercase tracking-widest text-ink-4 mb-1.5'

function Field({ label, htmlFor, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className={labelClass}>{label}</label>
      {children}
    </div>
  )
}

// Painel de um widget: tipo de gráfico, dados (métrica/agrupamento) e estilo. O período é o filtro único da página. Só oferece o que o catálogo permite
// (o servidor valida de novo). Mudar a métrica troca o agrupamento se o atual não existir para ela.
export default function WidgetConfigPanel({ widget, onChange, onRemove, onClose }) {
  const { type, title, query, style = {} } = widget
  const theme = useThemeColors()
  // Não oferece uma cor fixa que fica igual (ou quase) à cor do tema atual — ex.: o verde no tema Sage.
  const colors = COLORS.filter((c) => c.id === 'brand' || !isSimilarColor(c.css, theme.brand))
  const metric = METRICS[query.metric]
  const dimensions = ['total', ...metric.dimensions]
  const categorical = !['total', 'dia', 'mes'].includes(query.dimension)
  const chartType = type !== 'kpi' && type !== 'tabela'

  const setQuery = (patch) => onChange({ ...widget, query: { ...query, ...patch } })
  const setStyle = (patch) => onChange({ ...widget, style: { ...style, ...patch } })

  function changeMetric(next) {
    const dims = ['total', ...METRICS[next].dimensions]
    setQuery({ metric: next, dimension: dims.includes(query.dimension) ? query.dimension : 'total' })
  }

  function changeType(next) {
    // KPI mostra um número só; gráficos e tabela precisam de agrupamento.
    const patch = { ...widget, type: next }
    if (next === 'kpi') patch.query = { ...query, dimension: 'total' }
    else if (query.dimension === 'total') patch.query = { ...query, dimension: metric.dimensions[0] }
    onChange(patch)
  }

  return (
    <aside className="bg-surface border border-line rounded-xl p-5 space-y-4" aria-label="Configurar widget">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-display font-medium text-ink">Configurar widget</h2>
        <button type="button" onClick={onClose} aria-label="Fechar painel" className="text-ink-3 hover:text-ink cursor-pointer">
          <Icon name="x" size={16} />
        </button>
      </div>

      <Field label="Título" htmlFor="w-title">
        <input id="w-title" value={title} maxLength={60} placeholder={metric.label} onChange={e => onChange({ ...widget, title: e.target.value })} className={fieldClass.replace('cursor-pointer', '')} />
      </Field>

      <Field label="Tipo de gráfico">
        <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Tipo de gráfico">
          {Object.entries(WIDGET_TYPES).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={type === id}
              onClick={() => changeType(id)}
              className={`h-[34px] rounded-lg text-[12.5px] font-medium border cursor-pointer transition-colors ${type === id ? 'bg-brand text-white border-brand' : 'bg-surface text-ink-3 border-line hover:border-brand/40'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Dado" htmlFor="w-metric">
        <select id="w-metric" value={query.metric} onChange={e => changeMetric(e.target.value)} className={fieldClass}>
          {Object.entries(METRICS).map(([id, m]) => <option key={id} value={id}>{m.label}</option>)}
        </select>
      </Field>

      {type !== 'kpi' && (
        <Field label="Agrupar" htmlFor="w-dimension">
          <select id="w-dimension" value={query.dimension} onChange={e => setQuery({ dimension: e.target.value })} className={fieldClass}>
            {dimensions.filter(d => d !== 'total').map(d => <option key={d} value={d}>{DIMENSIONS[d]}</option>)}
          </select>
        </Field>
      )}

      {categorical && type !== 'kpi' && (
        <Field label="Quantidade de itens" htmlFor="w-limit">
          <select id="w-limit" value={query.limit ?? 10} onChange={e => setQuery({ limit: Number(e.target.value) })} className={fieldClass}>
            {[3, 5, 10, 20].map(n => <option key={n} value={n}>Top {n}</option>)}
          </select>
        </Field>
      )}

      {type !== 'tabela' && (
        <Field label="Cor">
          <div className="flex gap-2" role="group" aria-label="Cor do widget">
            {colors.map(c => (
              <button
                key={c.id}
                type="button"
                title={c.label}
                aria-label={c.label}
                aria-pressed={(style.color ?? 'brand') === c.id}
                onClick={() => setStyle({ color: c.id })}
                className={`w-8 h-8 rounded-full cursor-pointer border-2 ${(style.color ?? 'brand') === c.id ? 'border-ink' : 'border-transparent'}`}
                style={{ background: c.css }}
              />
            ))}
          </div>
        </Field>
      )}

      {chartType && (
        <label className="flex items-center gap-2 text-[13.5px] text-ink-2 cursor-pointer">
          <input type="checkbox" checked={Boolean(style.labels)} onChange={e => setStyle({ labels: e.target.checked })} />
          Mostrar valores no gráfico
        </label>
      )}

      <Button variant="ghost" size="sm" onClick={onRemove} className="w-full justify-center !text-danger">
        <Icon name="trash" size={14} /> Remover widget
      </Button>
    </aside>
  )
}
