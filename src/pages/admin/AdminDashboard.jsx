import { useState, useEffect } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Cell,
} from 'recharts'
import AppLayout from '@/components/layout/AppLayout'
import Sidebar from '@/components/layout/Sidebar'
import { PageSpinner } from '@/components/ui/Spinner'
import Avatar from '@/components/ui/Avatar'
import Icon from '@/components/ui/Icons'
import MoneyValue from '@/components/ui/MoneyValue'
import usePrivacyStore from '@/store/privacyStore'
import useAuthStore from '@/store/authStore'
import api from '@/lib/api'
import { navItemsByRole } from '@/config/navItems'
import { formatCurrency } from '@/lib/format'

const navItems = navItemsByRole['Admin']

const BRAND = '#8b4a2b'
const GOLD = '#c9a57b'

function formatDateShort(iso) {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

function KpiCard({ icon, label, value, sub, highlight, money }) {
  const valueEl = money ? <MoneyValue>{value}</MoneyValue> : value
  return (
    <div className={`min-w-0 rounded-xl border p-5 flex flex-col gap-3 ${highlight ? 'bg-brand text-white border-brand' : 'bg-surface border-line'}`}>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-mono uppercase tracking-widest ${highlight ? 'text-white/70' : 'text-ink-4'}`}>{label}</span>
        <span className={`p-1.5 rounded-lg ${highlight ? 'bg-white/15' : 'bg-brand-soft'}`}>
          <Icon name={icon} size={16} className={highlight ? 'text-white' : 'text-brand'} />
        </span>
      </div>
      <p className={`text-[32px] font-serif font-light leading-none tracking-wide break-words ${highlight ? 'text-white' : 'text-ink'}`}>{valueEl}</p>
      {sub && <p className={`text-xs ${highlight ? 'text-white/60' : 'text-ink-4'}`}>{sub}</p>}
    </div>
  )
}

function AlertBanner({ count }) {
  if (!count) return null
  return (
    <div className="flex items-center gap-3 rounded-xl border border-warning bg-warning-soft px-5 py-4">
      <Icon name="alertCircle" size={18} className="text-warning shrink-0" />
      <p className="text-sm text-ink-2">
        <span className="font-semibold">{count} comanda{count !== 1 ? 's' : ''}</span> em aberto há mais de 7 dias — verifique o caixa.
      </p>
    </div>
  )
}

const CustomTooltipArea = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-line rounded-lg px-3 py-2 shadow-sm text-sm">
      <p className="text-ink-4 text-xs mb-1">{label}</p>
      <p className="text-ink font-medium"><MoneyValue>{formatCurrency(payload[0].value)}</MoneyValue></p>
    </div>
  )
}

const CustomTooltipBar = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-line rounded-lg px-3 py-2 shadow-sm text-sm">
      <p className="text-ink font-medium">{payload[0].value} agendamento{payload[0].value !== 1 ? 's' : ''}</p>
    </div>
  )
}

const PRESETS = [
  { id: '7d', label: '7 dias' },
  { id: '30d', label: '30 dias' },
  { id: '60d', label: '60 dias' },
  { id: '90d', label: '90 dias' },
  { id: 'custom', label: 'Personalizado' },
]

const PRESET_DAYS = { '7d': 6, '30d': 29, '60d': 59, '90d': 89 }

function toLocalDateStringFE(date) {
  return date.toLocaleDateString('en-CA')
}

function rangeForPreset(preset) {
  const now = new Date()
  const from = new Date(now)
  from.setDate(from.getDate() - PRESET_DAYS[preset])
  return { from: toLocalDateStringFE(from), to: toLocalDateStringFE(now) }
}

export default function AdminDashboard() {
  const { user } = useAuthStore()
  const valuesHidden = usePrivacyStore((s) => s.hidden)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [preset, setPreset] = useState('7d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  useEffect(() => {
    if (preset === 'custom' && (!customFrom || !customTo)) return
    setLoading(true)
    const params = preset === 'custom' ? { from: customFrom, to: customTo } : rangeForPreset(preset)
    api.get('/dashboard', { params })
      .then(res => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [preset, customFrom, customTo])

  const sidebar = <Sidebar navItems={navItems} footerUser={user?.name} footerRole="Admin" />

  const periodFilter = (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map(p => (
        <button
          key={p.id}
          onClick={() => setPreset(p.id)}
          className={`h-[34px] px-3 rounded-full text-[12.5px] font-medium transition-colors cursor-pointer ${preset === p.id ? 'bg-brand text-white' : 'bg-surface border border-line text-ink-3 hover:border-brand/40'}`}
        >
          {p.label}
        </button>
      ))}
      {preset === 'custom' && (
        <div className="flex items-center gap-2 ml-1">
          <input
            type="date"
            value={customFrom}
            max={customTo || undefined}
            onChange={e => setCustomFrom(e.target.value)}
            className="h-[34px] px-2.5 rounded-lg border border-line bg-surface text-ink-2 text-[12.5px] font-body focus:outline-none focus:border-brand cursor-pointer"
          />
          <span className="text-ink-4 text-[12px]">até</span>
          <input
            type="date"
            value={customTo}
            min={customFrom || undefined}
            onChange={e => setCustomTo(e.target.value)}
            className="h-[34px] px-2.5 rounded-lg border border-line bg-surface text-ink-2 text-[12.5px] font-body focus:outline-none focus:border-brand cursor-pointer"
          />
        </div>
      )}
    </div>
  )

  if (loading || !data) return (
    <AppLayout sidebar={sidebar}>
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-display font-semibold tracking-tight text-ink">Dashboard</h1>
          {periodFilter}
        </div>
        {loading ? <PageSpinner /> : (
          <div className="flex items-center justify-center h-64 text-ink-4 text-sm">
            Não foi possível carregar o dashboard.
          </div>
        )}
      </div>
    </AppLayout>
  )

  const { hoje, mes, top_servicos, receita_diaria, alertas, ranking_profissionais, periodo } = data
  const taxa = mes.taxa_cancelamento

  function formatPeriodLabel() {
    if (!periodo?.custom) return new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    const [fy, fm, fd] = periodo.from.split('-')
    const [ty, tm, td] = periodo.to.split('-')
    return `${fd}/${fm}/${fy} — ${td}/${tm}/${ty}`
  }

  return (
    <AppLayout sidebar={sidebar}>
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-semibold tracking-tight text-ink">Dashboard</h1>
            <p className="text-sm text-ink-4 mt-1">
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          {periodFilter}
        </div>

        {/* Alertas */}
        <AlertBanner count={alertas.comandas_antigas} />

        {/* KPIs — hoje */}
        <section>
          <h2 className="text-xs font-mono uppercase tracking-widest text-ink-4 mb-3">Hoje</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard icon="cal" label="Agendamentos" value={hoje.agendamentos} sub="Confirmados e pendentes" highlight />
            <KpiCard icon="cash" label="Receita do dia" value={formatCurrency(hoje.receita)} sub="Comandas pagas hoje" money />
            <KpiCard icon="receipt" label="Comandas abertas" value={hoje.comandas_abertas} sub="Aguardando pagamento" />
          </div>
        </section>

        {/* KPIs — período selecionado */}
        <section>
          <h2 className="text-xs font-mono uppercase tracking-widest text-ink-4 mb-3">
            {formatPeriodLabel()}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard icon="chart" label="Receita do período" value={formatCurrency(mes.receita)} sub={`${mes.total_comandas_pagas} comanda${mes.total_comandas_pagas !== 1 ? 's' : ''} paga${mes.total_comandas_pagas !== 1 ? 's' : ''}`} highlight money />
            <KpiCard icon="tag" label="Ticket médio" value={formatCurrency(mes.ticket_medio)} sub="Por comanda paga" money />
            <KpiCard icon="check" label="Comandas pagas" value={mes.total_comandas_pagas} sub="No período" />
            <KpiCard
              icon="alertCircle"
              label="Cancelamentos"
              value={taxa ? `${taxa.pct}%` : '—'}
              sub={taxa ? `${taxa.cancelados} de ${taxa.total} agendamentos` : 'Sem dados'}
            />
          </div>
        </section>

        {/* Gráfico receita + top serviços */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">

          {/* Receita diária */}
          <div className="bg-surface border border-line rounded-xl p-5">
            <h2 className="text-sm font-display font-medium text-ink mb-1">Receita diária</h2>
            <p className="text-xs text-ink-4 mb-5">Comandas pagas por dia no período selecionado</p>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={receita_diaria} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="receitaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={BRAND} stopOpacity={0.18} />
                      <stop offset="95%" stopColor={BRAND} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8ddd6" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDateShort}
                    tick={{ fontSize: 10, fill: '#b8a89a' }}
                    tickLine={false}
                    axisLine={false}
                    interval={6}
                  />
                  <YAxis
                    tickFormatter={v => valuesHidden ? '••••' : `R$${Number(v).toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })}`}
                    tick={{ fontSize: 10, fill: '#b8a89a' }}
                    tickLine={false}
                    axisLine={false}
                    width={56}
                  />
                  <Tooltip content={<CustomTooltipArea />} />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke={BRAND}
                    strokeWidth={2}
                    fill="url(#receitaGrad)"
                    dot={false}
                    activeDot={{ r: 4, fill: BRAND }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top serviços */}
          <div className="bg-surface border border-line rounded-xl p-5">
            <h2 className="text-sm font-display font-medium text-ink mb-1">Top serviços</h2>
            <p className="text-xs text-ink-4 mb-5">Agendamentos por serviço</p>
            {top_servicos.length === 0 ? (
              <p className="text-sm text-ink-4 text-center py-10">Sem dados no período.</p>
            ) : (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={top_servicos}
                    layout="vertical"
                    margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e8ddd6" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10, fill: '#b8a89a' }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 11, fill: '#6b5c55' }}
                      tickLine={false}
                      axisLine={false}
                      width={110}
                      tickFormatter={n => n.length > 14 ? n.slice(0, 14) + '…' : n}
                    />
                    <Tooltip content={<CustomTooltipBar />} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={22}>
                      {top_servicos.map((_, i) => (
                        <Cell key={i} fill={i === 0 ? BRAND : GOLD} fillOpacity={i === 0 ? 1 : 0.65 - i * 0.08} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Ranking de profissionais */}
        <section>
          <div className="bg-surface border border-line rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-line">
              <h2 className="text-sm font-display font-medium text-ink">Ranking de profissionais</h2>
              <p className="text-xs text-ink-4 mt-0.5">Receita gerada no período · top {ranking_profissionais.length}</p>
            </div>

            {ranking_profissionais.length === 0 ? (
              <p className="text-sm text-ink-4 text-center py-10">Nenhuma transação registrada neste período.</p>
            ) : (
              <>
                {/* Desktop table */}
                <table className="hidden md:table w-full text-sm">
                  <thead>
                    <tr className="border-b border-line">
                      <th className="text-left px-5 py-3 font-mono text-[10.5px] uppercase tracking-widest text-ink-4 font-normal">#</th>
                      <th className="text-left px-5 py-3 font-mono text-[10.5px] uppercase tracking-widest text-ink-4 font-normal">Profissional</th>
                      <th className="text-right px-5 py-3 font-mono text-[10.5px] uppercase tracking-widest text-ink-4 font-normal">Atend.</th>
                      <th className="text-right px-5 py-3 font-mono text-[10.5px] uppercase tracking-widest text-ink-4 font-normal">Receita gerada</th>
                      <th className="text-right px-5 py-3 font-mono text-[10.5px] uppercase tracking-widest text-ink-4 font-normal">Comissão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranking_profissionais.map((p, i) => (
                      <tr key={p.professional_id} className="border-b border-line-2 last:border-0 hover:bg-surface-2 transition-colors">
                        <td className="px-5 py-3.5 font-mono text-[12px] text-ink-4">{i + 1}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={p.name} index={i} size="sm" />
                            <span className="font-medium text-ink text-[13.5px]">{p.name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono text-[12px] text-ink-2">{p.atendimentos}</td>
                        <td className="px-5 py-3.5 text-right font-mono text-[12.5px] text-ink"><MoneyValue>{formatCurrency(p.gross_amount)}</MoneyValue></td>
                        <td className="px-5 py-3.5 text-right">
                          <span className="font-mono text-[12.5px] font-semibold text-brand"><MoneyValue>{formatCurrency(p.commission_amount)}</MoneyValue></span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Mobile cards */}
                <div className="md:hidden divide-y divide-line-2">
                  {ranking_profissionais.map((p, i) => (
                    <div key={p.professional_id} className="flex items-center gap-3 px-4 py-4">
                      <span className="font-mono text-[11px] text-ink-4 w-4 shrink-0">{i + 1}</span>
                      <Avatar name={p.name} index={i} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-[13px] truncate">{p.name}</div>
                        <div className="font-mono text-[11px] text-ink-4">{p.atendimentos} atend. · <MoneyValue>{formatCurrency(p.gross_amount)}</MoneyValue></div>
                      </div>
                      <span className="font-mono text-[12px] font-semibold text-brand shrink-0"><MoneyValue>{formatCurrency(p.commission_amount)}</MoneyValue></span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

      </div>
    </AppLayout>
  )
}
