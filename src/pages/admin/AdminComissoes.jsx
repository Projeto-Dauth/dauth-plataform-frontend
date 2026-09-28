import { useState, useEffect } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import Sidebar from '@/components/layout/Sidebar'
import Avatar from '@/components/ui/Avatar'
import Chip from '@/components/ui/Chip'
import Icon from '@/components/ui/Icons'
import Button from '@/components/ui/Button'
import SearchableSelect from '@/components/ui/SearchableSelect'
import { PageSpinner } from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'
import LoadMoreButton from '@/components/ui/LoadMoreButton'
import MoneyValue from '@/components/ui/MoneyValue'
import { useToast } from '@/context/ToastContext'
import useAuthStore from '@/store/authStore'
import api from '@/lib/api'
import { navItemsByRole } from '@/config/navItems'
import { useTour } from '@/hooks/useTour'
import { adminCaixaComissoesSteps } from '@/tours/adminCaixaComissoes'
import { usePaginatedList } from '@/hooks/usePaginatedList'

const navItems = navItemsByRole['Admin']

const PRESETS = [
  { key: 'todas', label: 'Todas' },
  { key: 'dia', label: 'Dia' },
  { key: 'semana', label: 'Semana' },
  { key: 'quinzena', label: 'Quinzena' },
  { key: 'mes', label: 'Mês' },
  { key: 'personalizado', label: 'Personalizado' },
]

const PAY_METHODS = [
  { key: 'pix', label: 'Pix' },
  { key: 'dinheiro', label: 'Dinheiro' },
  { key: 'cartao_debito', label: 'Débito' },
  { key: 'cartao_credito', label: 'Crédito' },
]

const METHOD_LABELS = {
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  cartao_debito: 'Débito',
  cartao_credito: 'Crédito',
}

function toLocalDateStr(date) {
  return date.toLocaleDateString('en-CA')
}

function getDateRange(preset) {
  if (preset === 'todas' || preset === 'personalizado') return { from: null, to: null }

  const today = new Date()
  const to = toLocalDateStr(today)

  if (preset === 'dia') return { from: to, to }

  if (preset === 'semana') {
    const day = today.getDay()
    const monday = new Date(today)
    monday.setDate(today.getDate() - ((day + 6) % 7))
    return { from: toLocalDateStr(monday), to }
  }

  if (preset === 'quinzena') {
    const start = new Date(today)
    start.setDate(today.getDate() - 14)
    return { from: toLocalDateStr(start), to }
  }

  const start = new Date(today.getFullYear(), today.getMonth(), 1)
  return { from: toLocalDateStr(start), to }
}

function formatCurrency(v) {
  return `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(iso) {
  if (!iso) return '—'
  // Data pura (YYYY-MM-DD, ex: data do agendamento) NÃO pode passar por new Date(): o JS lê como meia-noite UTC
  // e no Brasil (UTC-3) exibe o dia anterior. Timestamps com hora (data do pagamento) continuam via Date.
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso.split('-').reverse().join('/')
  return new Date(iso).toLocaleDateString('pt-BR')
}

function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function groupByProfessional(transactions) {
  const map = {}
  transactions.forEach(tx => {
    const id = tx.professional_id
    if (!map[id]) map[id] = { professional_id: id, name: tx.professional_name, rows: [] }
    map[id].rows.push(tx)
  })
  return Object.values(map)
}

function CommissionSection({ title, groups, onMarcarRepassado, onPagarTodas, preparando = false, paid = false, totalsByProf = {} }) {
  const totalRows = groups.reduce((s, g) => {
    const real = totalsByProf[g.professional_id]
    return s + (real !== undefined ? (paid ? real.count_repassado : real.count_pendente) : g.rows.length)
  }, 0)
  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <span className="font-mono text-[11px] uppercase tracking-widest text-ink-3">{title}</span>
        <span className="font-mono text-[11px] text-ink-4">({totalRows})</span>
        <div className="flex-1 border-t border-line-2" />
      </div>
      <div className="space-y-5">
        {groups.map((g, gi) => {
          const realTotal = totalsByProf[g.professional_id]
          const totalToShow = realTotal !== undefined
            ? (paid ? realTotal.total_repassado : realTotal.total_pendente)
            : g.rows.reduce((s, r) => s + r.commission_amount, 0)
          const countToShow = realTotal !== undefined
            ? (paid ? realTotal.count_repassado : realTotal.count_pendente)
            : g.rows.length
          return (
          <div key={g.professional_id} className="bg-surface border border-line rounded-[14px] overflow-hidden">
            <div className="px-5 py-3 bg-surface-2 border-b border-line">
              <div className="flex items-center gap-2.5">
                <Avatar name={g.name} index={gi} size="sm" />
                <span className="font-medium text-[13.5px] text-ink flex-1 min-w-0 truncate">{g.name}</span>
                <span className={`font-mono text-[13px] font-semibold shrink-0 ${paid ? 'text-ink-3' : 'text-brand'}`}>
                  <MoneyValue>{formatCurrency(totalToShow)}</MoneyValue>
                </span>
                {!paid && (
                  <button
                    onClick={() => onPagarTodas(g)}
                    disabled={preparando}
                    className="shrink-0 hidden md:inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-medium bg-brand text-white hover:bg-brand/90 cursor-pointer transition-colors disabled:opacity-60">
                    Pagar todas
                    <Icon name="arrowRight" size={11} />
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between mt-2 pl-[38px]">
                <span className="font-mono text-[11px] text-ink-4">{countToShow} atendimento{countToShow !== 1 ? 's' : ''}</span>
                {!paid && (
                  <button
                    onClick={() => onPagarTodas(g)}
                    disabled={preparando}
                    className="md:hidden inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-medium bg-brand text-white hover:bg-brand/90 cursor-pointer transition-colors disabled:opacity-60">
                    Pagar todas
                    <Icon name="arrowRight" size={11} />
                  </button>
                )}
              </div>
            </div>

            <table className="w-full text-sm hidden md:table">
              <thead>
                <tr className="border-b border-line bg-surface-2">
                  <th className="text-left px-5 py-3 font-mono text-[10.5px] uppercase tracking-widest text-ink-4 font-normal">Cliente</th>
                  <th className="text-left px-5 py-3 font-mono text-[10.5px] uppercase tracking-widest text-ink-4 font-normal">Serviço</th>
                  <th className="text-right px-5 py-3 font-mono text-[10.5px] uppercase tracking-widest text-ink-4 font-normal">Data agend.</th>
                  <th className="text-right px-5 py-3 font-mono text-[10.5px] uppercase tracking-widest text-ink-4 font-normal">Data pgto.</th>
                  <th className="text-right px-5 py-3 font-mono text-[10.5px] uppercase tracking-widest text-ink-4 font-normal">Valor serviço</th>
                  <th className="text-right px-5 py-3 font-mono text-[10.5px] uppercase tracking-widest text-ink-4 font-normal">Comissão</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {g.rows.map(tx => (
                  <tr key={tx.uuid} className="border-b border-line-2 last:border-0 hover:bg-surface-2 transition-colors">
                    <td className="px-5 py-3 text-[13px] text-ink-2">{tx.cliente}</td>
                    <td className="px-5 py-3 text-[12px] text-ink-3">
                      {tx.servico}
                      {tx.papel === 'assistente' && (
                        <span className="ml-1.5 inline-flex items-center px-1.5 py-[1px] rounded-full text-[10px] font-medium bg-surface-3 text-ink-3 align-middle">
                          Assistente
                        </span>
                      )}
                      {tx.via_pacote && (
                        <span className="ml-1.5 inline-flex items-center px-1.5 py-[1px] rounded-full text-[10px] font-medium bg-brand-soft text-brand align-middle">
                          Via pacote
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-[12px] text-ink-3">{formatDate(tx.appointment_date)}</td>
                    <td className="px-5 py-3 text-right font-mono text-[12px] text-ink-4">{formatDate(tx.data)}</td>
                    <td className="px-5 py-3 text-right font-mono text-[12px] text-ink">
                      {tx.via_pacote ? <span className="text-ink-4">Pago no pacote</span> : <MoneyValue>{formatCurrency(tx.gross_amount)}</MoneyValue>}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-[13px] font-semibold text-brand"><MoneyValue>{formatCurrency(tx.commission_amount)}</MoneyValue></td>
                    <td className="px-5 py-3 text-right">
                      {paid ? (
                        <Chip variant="success">Repassado</Chip>
                      ) : (
                        <button
                          onClick={() => onMarcarRepassado(tx)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-warning-soft text-warning border border-warning/30 hover:bg-warning/20 cursor-pointer transition-colors">
                          Marcar repassado
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="md:hidden divide-y divide-line-2">
              {g.rows.map(tx => (
                <div key={tx.uuid} className="px-4 py-3.5">
                  {/* Linha 1: cliente + serviço */}
                  <div className="mb-2.5">
                    <div className="text-[13.5px] font-medium text-ink leading-tight">{tx.cliente}</div>
                    <div className="text-[12px] text-ink-3 mt-0.5">
                      {tx.servico}
                      {tx.papel === 'assistente' && (
                        <span className="ml-1.5 inline-flex items-center px-1.5 py-[1px] rounded-full text-[10px] font-medium bg-surface-3 text-ink-3 align-middle">
                          Assistente
                        </span>
                      )}
                      {tx.via_pacote && (
                        <span className="ml-1.5 inline-flex items-center px-1.5 py-[1px] rounded-full text-[10px] font-medium bg-brand-soft text-brand align-middle">
                          Via pacote
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Linha 2: datas + valores */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-ink-4 mb-0.5">Agendamento</div>
                      <div className="font-mono text-[12px] text-ink-3">{formatDate(tx.appointment_date)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-ink-4 mb-0.5">Pagamento</div>
                      <div className="font-mono text-[12px] text-ink-3">{formatDate(tx.data)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-ink-4 mb-0.5">Valor serviço</div>
                      <div className="font-mono text-[12px] text-ink-2">
                        {tx.via_pacote ? <span className="text-ink-4">Pago no pacote</span> : <MoneyValue>{formatCurrency(tx.gross_amount)}</MoneyValue>}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-ink-4 mb-0.5">Comissão</div>
                      <div className="font-mono text-[13px] font-semibold text-brand"><MoneyValue>{formatCurrency(tx.commission_amount)}</MoneyValue></div>
                    </div>
                  </div>
                  {/* Linha 3: ação */}
                  {paid
                    ? <Chip variant="success">Repassado</Chip>
                    : <button
                        onClick={() => onMarcarRepassado(tx)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-medium bg-warning-soft text-warning border border-warning/30 cursor-pointer transition-colors">
                        Marcar como repassado
                      </button>
                  }
                </div>
              ))}
            </div>
          </div>
        )})}
      </div>
    </>
  )
}

function ModalPagarComissoes({ group, onClose, onConfirm, pagando }) {
  const [selecionados, setSelecionados] = useState(() => group.rows.map(r => r.uuid))
  const [method, setMethod] = useState(null)

  const toggle = (uuid) => {
    setSelecionados(prev =>
      prev.includes(uuid) ? prev.filter(id => id !== uuid) : [...prev, uuid]
    )
  }

  const totalSelecionado = group.rows
    .filter(r => selecionados.includes(r.uuid))
    .reduce((s, r) => s + r.commission_amount, 0)

  const canConfirm = selecionados.length > 0 && method !== null

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm px-0 md:px-4">
      <div className="w-full md:max-w-[580px] bg-surface rounded-t-2xl md:rounded-[16px] shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-line shrink-0">
          <div className="flex-1 min-w-0">
            <h4 className="font-display font-medium text-[15px] text-ink">Pagar comissões</h4>
            <p className="text-[12px] text-ink-3 mt-0.5 truncate">{group.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-ink-4 hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer">
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* Lista de transações */}
        <div className="overflow-y-auto flex-1 px-5 py-3">
          <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto] gap-x-4 pb-2 mb-1 border-b border-line-2">
            <span className="font-mono text-[10.5px] uppercase tracking-widest text-ink-4">Serviço / Cliente</span>
            <span className="font-mono text-[10.5px] uppercase tracking-widest text-ink-4 text-right">Agendamento</span>
            <span className="font-mono text-[10.5px] uppercase tracking-widest text-ink-4 text-right">Comissão</span>
            <span />
          </div>

          <div className="divide-y divide-line-2">
            {group.rows.map(tx => {
              const ativo = selecionados.includes(tx.uuid)
              return (
                <div key={tx.uuid} className={`flex items-center gap-3 py-3 transition-opacity ${ativo ? '' : 'opacity-40'}`}>
                  <div className="flex-1 min-w-0">
                    <div className={`text-[13px] text-ink ${ativo ? '' : 'line-through'}`}>{tx.servico}</div>
                    <div className="text-[11px] text-ink-3 truncate">{tx.cliente}</div>
                  </div>
                  <span className="font-mono text-[11.5px] text-ink-3 shrink-0">{formatDate(tx.appointment_date)}</span>
                  <span className={`font-mono text-[13px] font-semibold shrink-0 ${ativo ? 'text-brand' : 'text-ink-4'}`}>
                    <MoneyValue>{formatCurrency(tx.commission_amount)}</MoneyValue>
                  </span>
                  <button
                    onClick={() => toggle(tx.uuid)}
                    className={`shrink-0 w-7 h-7 flex items-center justify-center rounded-full border transition-colors cursor-pointer ${
                      ativo
                        ? 'border-danger/40 text-danger hover:bg-danger-soft'
                        : 'border-success/40 text-success hover:bg-success/10'
                    }`}>
                    <Icon name={ativo ? 'x' : 'plus'} size={12} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Método de pagamento */}
        <div className="px-5 pt-3 pb-1 border-t border-line-2 shrink-0">
          <p className="font-mono text-[10.5px] uppercase tracking-widest text-ink-4 mb-2">Método de pagamento</p>
          <div className="grid grid-cols-4 gap-2">
            {PAY_METHODS.map(m => (
              <button
                key={m.key}
                onClick={() => setMethod(m.key)}
                className={`py-2 rounded-lg border text-[12px] font-medium transition-colors cursor-pointer ${
                  method === m.key
                    ? 'bg-ink text-bg border-ink'
                    : 'bg-surface border-line text-ink-2 hover:border-ink-3'
                }`}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <span className="font-mono text-[11px] uppercase tracking-widest text-ink-4">
              Total selecionado ({selecionados.length}/{group.rows.length})
            </span>
            <span className="font-mono text-[18px] font-semibold text-brand"><MoneyValue>{formatCurrency(totalSelecionado)}</MoneyValue></span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={pagando}
              className="flex-1 h-[42px] rounded-lg border border-line text-ink-2 text-[13px] font-medium hover:bg-surface-2 transition-colors cursor-pointer disabled:opacity-50">
              Cancelar
            </button>
            <Button
              loading={pagando}
              disabled={!canConfirm}
              onClick={() => {
                // Cada linha selecionada pode representar mais de 1 Transaction real
                // (pagamento dividido em vários métodos) — o bulk-pay precisa da lista
                // completa, não só do id representativo de cada linha.
                const uuids = group.rows.filter(r => selecionados.includes(r.uuid)).flatMap(r => r.transaction_ids)
                onConfirm(uuids, method, totalSelecionado)
              }}
              className="flex-1">
              Confirmar repasse
            </Button>
          </div>
          {!method && selecionados.length > 0 && (
            <p className="text-[11px] text-ink-4 text-center mt-2">Selecione o método de pagamento para continuar</p>
          )}
        </div>
      </div>
    </div>
  )
}

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function HistoricoRepasses({ profFilter }) {
  const now = new Date()
  const [selMonth, setSelMonth] = useState(now.getMonth())
  const [selYear, setSelYear] = useState(now.getFullYear())
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  const years = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i)

  useEffect(() => {
    setLoading(true)
    const from = `${selYear}-${String(selMonth + 1).padStart(2, '0')}-01`
    const lastDay = new Date(selYear, selMonth + 1, 0).toLocaleDateString('en-CA')
    const params = new URLSearchParams({ from, to: lastDay })
    if (profFilter) params.set('professional_id', profFilter)
    api.get(`/transaction/commissions/history?${params}`)
      .then(res => setHistory(res.data.data ?? []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false))
  }, [profFilter, selMonth, selYear])

  const selects = (
    <div className="flex items-center gap-2 mb-5">
      <select value={selMonth} onChange={e => setSelMonth(Number(e.target.value))}
        className="h-[38px] px-3 rounded-lg border border-line bg-surface text-ink-2 text-[13px] font-body focus:outline-none focus:border-brand cursor-pointer">
        {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
      </select>
      <select value={selYear} onChange={e => setSelYear(Number(e.target.value))}
        className="h-[38px] px-3 rounded-lg border border-line bg-surface text-ink-2 text-[13px] font-body focus:outline-none focus:border-brand cursor-pointer">
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  )

  if (loading) return (
    <>
      {selects}
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3].map(i => <div key={i} className="h-14 bg-line rounded-xl" />)}
      </div>
    </>
  )

  if (history.length === 0) return (
    <>
      {selects}
      <p className="text-[13px] text-ink-4">Nenhum repasse registrado neste período.</p>
    </>
  )

  return (
    <>
      {selects}
      <div className="space-y-3">
      {history.map((h, hi) => (
        <div key={h.UUID} className="bg-surface border border-line rounded-[14px] overflow-hidden">
          <button
            onClick={() => setExpanded(expanded === h.UUID ? null : h.UUID)}
            className="w-full px-5 py-3.5 hover:bg-surface-2 transition-colors cursor-pointer text-left">
            <div className="flex items-center gap-3">
              <Avatar name={h.professional_name} index={hi} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] font-medium text-ink">{h.professional_name}</div>
                <div className="text-[11px] text-ink-4 mt-0.5 truncate">
                  {formatDateTime(h.paid_at)} · por {h.paid_by_name ?? 'registro antigo'}
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
              <Chip variant="ghost">{h.method ? (METHOD_LABELS[h.method] ?? h.method) : 'Método não registrado'}</Chip>
            </div>
          </button>

          {expanded === h.UUID && (
            <div className="border-t border-line-2 px-5 py-3">
              <p className="font-mono text-[10.5px] uppercase tracking-widest text-ink-4 mb-2">
                {h.transaction_count} transação{h.transaction_count !== 1 ? 'ões' : ''} incluída{h.transaction_count !== 1 ? 's' : ''}
              </p>
              <div className="space-y-1.5">
                {(h.transactions ?? []).map(t => (
                  <div key={t.uuid} className="flex items-center justify-between gap-2 text-[12.5px]">
                    <span className="text-ink-2 truncate">{t.cliente ?? 'Cliente'} · {t.servico ?? 'Produto'}</span>
                    <span className="font-mono text-ink-3 shrink-0">{t.commission_amount != null ? <MoneyValue>{formatCurrency(t.commission_amount)}</MoneyValue> : '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
      </div>
    </>
  )
}

export default function AdminComissoes() {
  const { user } = useAuthStore()
  const { addToast } = useToast()

  const [view, setView] = useState('comissoes') // 'comissoes' | 'historico'
  const [commissionTab, setCommissionTab] = useState('pendente') // 'pendente' | 'repassada'
  const [preset, setPreset] = useState('mes')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [profFilter, setProfFilter] = useState(null)
  const [profissionais, setProfissionais] = useState([])
  const [pagarModal, setPagarModal] = useState(null)
  const [pagando, setPagando] = useState(false)
  const [totals, setTotals] = useState({ totalPendente: 0, totalReceita: 0 })
  const [totalsByProf, setTotalsByProf] = useState({})
  const [preparandoModal, setPreparandoModal] = useState(false)

  const { from, to } = preset === 'personalizado'
    ? { from: customFrom || null, to: customTo || null }
    : getDateRange(preset)

  useEffect(() => {
    api.get('/transaction/commissions/totals-by-professional', {
      params: { ...(from && { from }), ...(to && { to }), ...(profFilter && { professional_id: profFilter }) },
    }).then(res => {
      const map = {}
      for (const row of res.data.data ?? []) {
        map[row.professional_id] = row
      }
      setTotalsByProf(map)
    }).catch(() => setTotalsByProf({}))
  }, [from, to, profFilter])

  const {
    items: transactions,
    loading,
    loadingMore,
    hasMore,
    reload,
    loadMore,
  } = usePaginatedList(
    (page, limit) => api.get('/transaction/all-commissions', {
      params: {
        ...(from && { from }),
        ...(to && { to }),
        ...(profFilter && { professional_id: profFilter }),
        commission_paid: commissionTab === 'repassada',
        page,
        limit,
      },
    }).then(res => {
      setTotals(res.data.totals ?? { totalPendente: 0, totalReceita: 0 })
      return res.data
    }),
    [from, to, profFilter, commissionTab]
  )

  const { restartTour } = useTour('admin_caixa_comissoes', adminCaixaComissoesSteps, !loading)

  useEffect(() => {
    api.get('/users', { params: { Role: 'Profissional', limit: 100 } })
      .then(res => setProfissionais(res.data.data ?? []))
      .catch(() => setProfissionais([]))
  }, [])

  // "Marcar repassado" de 1 linha reaproveita o modal/fluxo do "Pagar todas" (só com essa
  // linha pré-selecionada) para sempre passar por bulkPayCommissions — é o único caminho que
  // pede o método de pagamento e grava o CommissionPayout, então é o único que aparece no
  // Histórico. Um PATCH direto em Commission_paid (como era antes) muda a flag mas nunca cria
  // esse registro, e a comissão nunca aparecia na aba Histórico.
  function handleMarcarRepassado(tx) {
    setPagarModal({ professional_id: tx.professional_id, name: tx.professional_name, rows: [tx] })
  }

  // Busca o conjunto completo de comissões pendentes do profissional no período —
  // não depende do que já está carregado na tela (que pode ser só uma página),
  // garantindo que "Pagar todas" nunca perca comissões fora da página visível.
  async function abrirModalPagarTodas(group) {
    setPreparandoModal(true)
    try {
      const res = await api.get('/transaction/all-commissions', {
        params: {
          ...(from && { from }),
          ...(to && { to }),
          professional_id: group.professional_id,
          page: 1,
          limit: 1000,
        },
      })
      const rows = (res.data.data ?? []).filter(tx => !tx.commission_paid)
      setPagarModal({ professional_id: group.professional_id, name: group.name, rows })
    } catch (err) {
      addToast(err.response?.data?.error || 'Erro ao carregar comissões do profissional', 'error')
    } finally {
      setPreparandoModal(false)
    }
  }

  async function handleBulkPay(uuids, method, totalAmount) {
    setPagando(true)
    try {
      const res = await api.post('/transaction/commissions/bulk-pay', {
        transaction_ids: uuids,
        method,
        professional_id: pagarModal.professional_id,
        professional_name: pagarModal.name,
        total_amount: totalAmount,
      })
      const n = res.data.paid
      addToast(`${n} comissão${n !== 1 ? 'ões' : ''} marcada${n !== 1 ? 's' : ''} como repassada${n !== 1 ? 's' : ''}`, 'success')
      setPagarModal(null)
      reload()
    } catch (err) {
      addToast(err.response?.data?.error || 'Erro ao registrar repasse', 'error')
    } finally {
      setPagando(false)
    }
  }

  const pendentes = commissionTab === 'pendente' ? transactions : []
  const repassadas = commissionTab === 'repassada' ? transactions : []
  const totalPendente = totals.totalPendente
  const totalReceita = totals.totalReceita
  const groupsPendentes = groupByProfessional(pendentes)
  const groupsRepassadas = groupByProfessional(repassadas)

  const profOptions = [
    { value: null, label: 'Todos os profissionais' },
    ...profissionais.map(p => ({ value: p.UUID, label: p.Name }))
  ]

  const sidebar = (
    <Sidebar navItems={navItems} footerUser={user?.name} footerRole="Admin">Admin</Sidebar>
  )

  return (
    <AppLayout sidebar={sidebar}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-5 md:mb-6">
        <div>
          <h3 className="font-display font-medium text-[22px] md:text-[26px] tracking-tight">Comissões</h3>
          <p className="text-[12px] md:text-[13px] text-ink-3 mt-1">Acompanhe e repasse comissões dos profissionais</p>
          <button onClick={restartTour} className="inline-flex items-center gap-1 text-[11px] text-ink-4 hover:text-brand transition-colors mt-1.5" title="Repetir tour guiado">
            <Icon name="helpCircle" size={12} />
            Ver tour
          </button>
        </div>

        {view === 'comissoes' && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-surface-2 border border-line rounded-xl shrink-0 overflow-x-auto">
              {PRESETS.map(p => (
                <button
                  key={p.key}
                  onClick={() => setPreset(p.key)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors cursor-pointer ${
                    preset === p.key
                      ? 'bg-surface text-ink shadow-sm border border-line'
                      : 'text-ink-3 hover:text-ink'
                  }`}>
                  {p.label}
                </button>
              ))}
            </div>
            {preset === 'personalizado' && (
              <div className="flex items-center gap-2 shrink-0">
                <input
                  type="date"
                  value={customFrom}
                  onChange={e => setCustomFrom(e.target.value)}
                  max={customTo || undefined}
                  className="h-[38px] px-3 rounded-lg border border-line bg-surface text-ink-2 text-[13px] font-body focus:outline-none focus:border-brand"
                />
                <span className="text-ink-4 text-[12px]">até</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={e => setCustomTo(e.target.value)}
                  min={customFrom || undefined}
                  className="h-[38px] px-3 rounded-lg border border-line bg-surface text-ink-2 text-[13px] font-body focus:outline-none focus:border-brand"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 mb-6 border-b border-line">
        {[
          { key: 'comissoes', label: 'Comissões' },
          { key: 'historico', label: 'Histórico de repasses' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setView(t.key)}
            className={`px-4 pb-3 text-[13px] font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
              view === t.key
                ? 'border-brand text-brand'
                : 'border-transparent text-ink-3 hover:text-ink'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {view === 'historico' ? (
        <>
          {/* Filtro de profissional no histórico */}
          <div className="mb-5 max-w-[320px]">
            <SearchableSelect
              value={profFilter}
              onChange={setProfFilter}
              options={profOptions}
              placeholder="Todos os profissionais"
            />
          </div>
          <HistoricoRepasses profFilter={profFilter} profissionais={profissionais} />
        </>
      ) : (
        <>
          {/* Filtro de profissional */}
          <div className="mb-6 max-w-[320px]">
            <SearchableSelect
              value={profFilter}
              onChange={setProfFilter}
              options={profOptions}
              placeholder="Todos os profissionais"
            />
          </div>

          {loading ? <PageSpinner /> : transactions.length === 0 ? (
            <EmptyState icon="cash" title="Sem comissões" description="Nenhuma transação paga registrada neste período." />
          ) : (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="bg-surface border border-line rounded-xl p-5 flex flex-col gap-2">
                  <span className="font-mono text-[10.5px] uppercase tracking-widest text-ink-4">Receita total do período</span>
                  <span className="text-[28px] font-serif font-light leading-none tracking-wide text-ink"><MoneyValue>{formatCurrency(totalReceita)}</MoneyValue></span>
                </div>
                <div className="bg-brand border border-brand rounded-xl p-5 flex flex-col gap-2">
                  <span className="font-mono text-[10.5px] uppercase tracking-widest text-white/70">Comissões a repassar</span>
                  <span className="text-[28px] font-serif font-light leading-none tracking-wide text-white"><MoneyValue>{formatCurrency(totalPendente)}</MoneyValue></span>
                </div>
              </div>

              {/* Toggle A repassar / Repassadas */}
              <div className="flex items-center gap-2 mb-6">
                <button
                  onClick={() => setCommissionTab('pendente')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-medium border transition-colors cursor-pointer ${
                    commissionTab === 'pendente'
                      ? 'bg-warning/10 text-warning border-warning'
                      : 'bg-surface text-ink-3 border-line hover:border-ink-3'
                  }`}>
                  A repassar
                  {commissionTab === 'pendente' && (
                    <span className="font-mono text-[11px] px-1.5 py-0.5 rounded-full bg-warning/20 text-warning">
                      {pendentes.length}{hasMore ? '+' : ''}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setCommissionTab('repassada')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-medium border transition-colors cursor-pointer ${
                    commissionTab === 'repassada'
                      ? 'bg-success/10 text-success border-success/40'
                      : 'bg-surface text-ink-3 border-line hover:border-ink-3'
                  }`}>
                  Repassadas
                  {commissionTab === 'repassada' && (
                    <span className="font-mono text-[11px] px-1.5 py-0.5 rounded-full bg-success/20 text-success">
                      {repassadas.length}{hasMore ? '+' : ''}
                    </span>
                  )}
                </button>
              </div>

              {commissionTab === 'pendente' ? (
                groupsPendentes.length === 0
                  ? <EmptyState icon="check" title="Tudo repassado" description="Não há comissões pendentes neste período." />
                  : <CommissionSection
                      title="A repassar"
                      groups={groupsPendentes}
                      onMarcarRepassado={handleMarcarRepassado}
                      onPagarTodas={abrirModalPagarTodas}
                      preparando={preparandoModal}
                      totalsByProf={totalsByProf}
                    />
              ) : (
                groupsRepassadas.length === 0
                  ? <EmptyState icon="cash" title="Nenhum repasse" description="Nenhuma comissão repassada neste período." />
                  : <CommissionSection title="Repassadas" groups={groupsRepassadas} paid totalsByProf={totalsByProf} />
              )}

              {hasMore && <LoadMoreButton onClick={loadMore} loading={loadingMore} />}
            </>
          )}
        </>
      )}

      {pagarModal && (
        <ModalPagarComissoes
          group={pagarModal}
          onClose={() => setPagarModal(null)}
          onConfirm={handleBulkPay}
          pagando={pagando}
        />
      )}
    </AppLayout>
  )
}
