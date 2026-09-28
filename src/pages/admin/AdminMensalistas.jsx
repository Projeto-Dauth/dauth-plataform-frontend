import { useState, useEffect } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import Sidebar from '@/components/layout/Sidebar'
import Avatar from '@/components/ui/Avatar'
import Chip from '@/components/ui/Chip'
import Icon from '@/components/ui/Icons'
import { PageSpinner } from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'
import ModalPagarMensalidade from '@/components/ui/ModalPagarMensalidade'
import useAuthStore from '@/store/authStore'
import api from '@/lib/api'
import { navItemsByRole } from '@/config/navItems'
import MoneyValue from '@/components/ui/MoneyValue'

const navItems = navItemsByRole['Admin']

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const METHOD_LABELS = {
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  cartao_debito: 'Débito',
  cartao_credito: 'Crédito',
}

function pad2(n) { return String(n).padStart(2, '0') }

function monthStr(date) { return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}` }

function monthLabel(monthStr) {
  const [y, m] = monthStr.split('-').map(Number)
  return `${MONTHS[m - 1]} de ${y}`
}

function formatCurrency(v) {
  return `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(iso) {
  if (!iso) return '—'
  // Data pura (YYYY-MM-DD) não passa por new Date(): lida como UTC, no Brasil exibiria o dia anterior.
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso.split('-').reverse().join('/')
  return new Date(iso).toLocaleDateString('pt-BR')
}

function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

const now = new Date()
const CURRENT_MONTH = monthStr(now)
const PREV_MONTH = monthStr(new Date(now.getFullYear(), now.getMonth() - 1, 1))

const MONTH_PRESETS = [
  { key: 'todos', label: 'Todos' },
  { key: 'atual', label: 'Mês atual' },
  { key: 'passado', label: 'Mês passado' },
  { key: 'personalizado', label: 'Escolher mês' },
]

function EmAberto({ onOpenSettle }) {
  const [preset, setPreset] = useState('todos')
  const [customMonth, setCustomMonth] = useState(CURRENT_MONTH)
  const [search, setSearch] = useState('')
  const [clients, setClients] = useState([])
  const [totals, setTotals] = useState({ total_geral: 0, total_mes_atual: 0, total_atrasado: 0, clientes_count: 0 })
  const [loading, setLoading] = useState(true)

  const month = preset === 'atual' ? CURRENT_MONTH
    : preset === 'passado' ? PREV_MONTH
      : preset === 'personalizado' ? customMonth
        : null

  function load() {
    setLoading(true)
    api.get('/transaction/fiado-pending', { params: month ? { month } : {} })
      .then(res => {
        setClients(res.data.data ?? [])
        setTotals(res.data.totals ?? { total_geral: 0, total_mes_atual: 0, total_atrasado: 0, clientes_count: 0 })
      })
      .catch(() => { setClients([]); setTotals({ total_geral: 0, total_mes_atual: 0, total_atrasado: 0, clientes_count: 0 }) })
      .finally(() => setLoading(false))
  }

  useEffect(load, [month])

  const filteredClients = clients.filter(c => c.client_name.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-1 p-1 bg-surface-2 border border-line rounded-xl shrink-0 overflow-x-auto">
          {MONTH_PRESETS.map(p => (
            <button
              key={p.key}
              onClick={() => setPreset(p.key)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors cursor-pointer ${
                preset === p.key ? 'bg-surface text-ink shadow-sm border border-line' : 'text-ink-3 hover:text-ink'
              }`}>
              {p.label}
            </button>
          ))}
        </div>
        {preset === 'personalizado' && (
          <input
            type="month"
            value={customMonth}
            onChange={e => setCustomMonth(e.target.value)}
            className="h-[38px] px-3 rounded-lg border border-line bg-surface text-ink-2 text-[13px] font-body focus:outline-none focus:border-brand"
          />
        )}
      </div>

      <div className="relative mb-6 max-w-[320px]">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4 pointer-events-none">
          <Icon name="search" size={14} />
        </span>
        <input
          type="text"
          placeholder="Buscar cliente…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full h-[38px] pl-8 pr-3 rounded-md border border-line bg-surface text-ink-2 font-body text-[13px]
                     placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/12 transition-colors"
        />
      </div>

      {loading ? <PageSpinner /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-surface border border-line rounded-xl p-5 flex flex-col gap-2">
              <span className="font-mono text-[10.5px] uppercase tracking-widest text-ink-4">Total em aberto</span>
              <span className="text-[26px] font-serif font-light leading-none tracking-wide text-ink"><MoneyValue>{formatCurrency(totals.total_geral)}</MoneyValue></span>
            </div>
            <div className="bg-brand border border-brand rounded-xl p-5 flex flex-col gap-2">
              <span className="font-mono text-[10.5px] uppercase tracking-widest text-white/70">Deste mês</span>
              <span className="text-[26px] font-serif font-light leading-none tracking-wide text-white"><MoneyValue>{formatCurrency(totals.total_mes_atual)}</MoneyValue></span>
            </div>
            <div className="bg-danger-soft border border-danger/30 rounded-xl p-5 flex flex-col gap-2">
              <span className="font-mono text-[10.5px] uppercase tracking-widest text-danger">Atrasado (meses anteriores)</span>
              <span className="text-[26px] font-serif font-light leading-none tracking-wide text-danger"><MoneyValue>{formatCurrency(totals.total_atrasado)}</MoneyValue></span>
            </div>
            <div className="bg-surface border border-line rounded-xl p-5 flex flex-col gap-2">
              <span className="font-mono text-[10.5px] uppercase tracking-widest text-ink-4">Clientes pendentes</span>
              <span className="text-[26px] font-serif font-light leading-none tracking-wide text-ink">{totals.clientes_count}</span>
            </div>
          </div>

          {clients.length === 0 ? (
            <EmptyState icon="cash" title="Nenhuma mensalidade pendente" description={month ? `Sem pendências em ${monthLabel(month)}.` : 'Nenhum cliente com mensalidade em aberto.'} />
          ) : filteredClients.length === 0 ? (
            <EmptyState icon="search" title="Nenhum cliente encontrado" description={`Nenhuma mensalista corresponde a "${search}".`} />
          ) : (
            <div className="space-y-4">
              {filteredClients.map((c, ci) => (
                <div key={c.client_id} className="bg-surface border border-line rounded-[14px] overflow-hidden">
                  <div className="px-5 py-3.5 bg-surface-2 border-b border-line flex items-center gap-2.5">
                    <Avatar name={c.client_name} index={ci} size="sm" />
                    <span className="flex-1 min-w-0 font-medium text-[13.5px] text-ink truncate">{c.client_name}</span>
                    <div className="w-[76px] shrink-0">
                      {c.atrasado && <Chip variant="danger">Atrasado</Chip>}
                    </div>
                    <span className="font-mono text-[14px] font-semibold text-warning shrink-0 w-[84px] text-right"><MoneyValue>{formatCurrency(c.total)}</MoneyValue></span>
                    <button
                      onClick={() => onOpenSettle(c)}
                      className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-medium bg-brand text-white hover:bg-brand/90 cursor-pointer transition-colors">
                      Quitar
                      <Icon name="arrowRight" size={11} />
                    </button>
                  </div>
                  <div className="grid grid-cols-[1fr_5.5rem_5.5rem] gap-x-3 px-5 py-2 bg-surface-2/50 border-b border-line-2">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-ink-4">Serviço</span>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-ink-4 text-right">Data</span>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-ink-4 text-right">Valor</span>
                  </div>
                  <div className="divide-y divide-line-2">
                    {c.items.map(item => (
                      <div key={item.uuid} className="grid grid-cols-[1fr_5.5rem_5.5rem] gap-x-3 items-center px-5 py-2.5 text-[13px]">
                        <span className="text-ink-2 truncate">{item.servico}</span>
                        <span className="font-mono text-[11.5px] text-ink-4 text-right">
                          {formatDate(item.appointment_date ?? item.payment_date)}
                        </span>
                        <span className="font-mono text-ink-3 text-right"><MoneyValue>{formatCurrency(item.gross_amount)}</MoneyValue></span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  )
}

function Historico() {
  const [selMonth, setSelMonth] = useState(now.getMonth())
  const [selYear, setSelYear] = useState(now.getFullYear())
  const [search, setSearch] = useState('')
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  const years = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i)

  useEffect(() => {
    setLoading(true)
    const month = `${selYear}-${pad2(selMonth + 1)}`
    api.get('/transaction/fiado-settlements', { params: { month } })
      .then(res => setHistory(res.data.data ?? []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false))
  }, [selMonth, selYear])

  const filteredHistory = history.filter(h => h.client_name.toLowerCase().includes(search.trim().toLowerCase()))

  const filters = (
    <div className="flex flex-wrap items-center gap-2 mb-5">
      <select value={selMonth} onChange={e => setSelMonth(Number(e.target.value))}
        className="h-[38px] px-3 rounded-lg border border-line bg-surface text-ink-2 text-[13px] font-body focus:outline-none focus:border-brand cursor-pointer">
        {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
      </select>
      <select value={selYear} onChange={e => setSelYear(Number(e.target.value))}
        className="h-[38px] px-3 rounded-lg border border-line bg-surface text-ink-2 text-[13px] font-body focus:outline-none focus:border-brand cursor-pointer">
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
      <div className="relative w-full sm:w-[260px]">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4 pointer-events-none">
          <Icon name="search" size={14} />
        </span>
        <input
          type="text"
          placeholder="Buscar cliente…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full h-[38px] pl-8 pr-3 rounded-md border border-line bg-surface text-ink-2 font-body text-[13px]
                     placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/12 transition-colors"
        />
      </div>
    </div>
  )

  if (loading) return (
    <>
      {filters}
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3].map(i => <div key={i} className="h-14 bg-line rounded-xl" />)}
      </div>
    </>
  )

  if (history.length === 0) return (
    <>
      {filters}
      <p className="text-[13px] text-ink-4">Nenhuma quitação registrada neste mês.</p>
    </>
  )

  if (filteredHistory.length === 0) return (
    <>
      {filters}
      <p className="text-[13px] text-ink-4">Nenhuma quitação de "{search}" neste mês.</p>
    </>
  )

  return (
    <>
      {filters}
      <div className="space-y-3">
        {filteredHistory.map((h, hi) => (
          <div key={h.UUID} className="bg-surface border border-line rounded-[14px] overflow-hidden">
            <button
              onClick={() => setExpanded(expanded === h.UUID ? null : h.UUID)}
              className="w-full px-5 py-3.5 hover:bg-surface-2 transition-colors cursor-pointer text-left">
              <div className="flex items-center gap-3">
                <Avatar name={h.client_name} index={hi} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-medium text-ink">{h.client_name}</div>
                  <div className="text-[11px] text-ink-4 mt-0.5 truncate">
                    {formatDateTime(h.settled_at)} · por {h.settled_by_name}
                  </div>
                </div>
                <span className="font-mono text-[13px] font-semibold text-ink shrink-0"><MoneyValue>{formatCurrency(h.total_amount)}</MoneyValue></span>
                <Icon
                  name="chevronRight"
                  size={14}
                  className={`text-ink-4 shrink-0 transition-transform ${expanded === h.UUID ? 'rotate-90' : ''}`}
                />
              </div>
              <div className="mt-2 pl-[38px]">
                <Chip variant="ghost">{METHOD_LABELS[h.settlement_method] ?? h.settlement_method}</Chip>
              </div>
            </button>

            {expanded === h.UUID && (
              <div className="border-t border-line-2 px-5 py-3">
                <p className="font-mono text-[10.5px] uppercase tracking-widest text-ink-4">
                  {h.transaction_count} item{h.transaction_count !== 1 ? 's' : ''} quitado{h.transaction_count !== 1 ? 's' : ''}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}

export default function AdminMensalistas() {
  const { user } = useAuthStore()
  const [view, setView] = useState('aberto') // 'aberto' | 'historico'
  const [settleClient, setSettleClient] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  const sidebar = (
    <Sidebar navItems={navItems} footerUser={user?.name} footerRole="Admin">Admin</Sidebar>
  )

  return (
    <AppLayout sidebar={sidebar}>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-5 md:mb-6">
        <div>
          <h3 className="font-display font-medium text-[22px] md:text-[26px] tracking-tight">Mensalistas</h3>
          <p className="text-[12px] md:text-[13px] text-ink-3 mt-1">Acompanhe e quite as mensalidades pendentes por mês</p>
        </div>
      </div>

      <div className="flex items-center gap-0 mb-6 border-b border-line">
        {[
          { key: 'aberto', label: 'Em aberto' },
          { key: 'historico', label: 'Histórico de quitações' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setView(t.key)}
            className={`px-4 pb-3 text-[13px] font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
              view === t.key ? 'border-brand text-brand' : 'border-transparent text-ink-3 hover:text-ink'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {view === 'aberto' ? (
        <EmAberto key={reloadKey} onOpenSettle={setSettleClient} />
      ) : (
        <Historico />
      )}

      {settleClient && (
        <ModalPagarMensalidade
          client={{ client_id: settleClient.client_id, client_name: settleClient.client_name }}
          items={settleClient.items}
          total={settleClient.total}
          onClose={() => setSettleClient(null)}
          onSuccess={() => { setSettleClient(null); setReloadKey(k => k + 1) }}
        />
      )}
    </AppLayout>
  )
}
