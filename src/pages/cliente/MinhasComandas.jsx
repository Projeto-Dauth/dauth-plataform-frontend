import { useState, useEffect } from 'react'
import { useNavigate, NavLink, useParams } from 'react-router-dom'
import AppLayout from '@/components/layout/AppLayout'
import Chip from '@/components/ui/Chip'
import Icon from '@/components/ui/Icons'
import Button from '@/components/ui/Button'
import { PageSpinner } from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'
import MoneyValue from '@/components/ui/MoneyValue'
import ClienteSidebar from '@/components/layout/ClienteSidebar'
import useAuthStore from '@/store/authStore'
import api from '@/lib/api'

const STATUS_FILTERS = ['Todos', 'Em aberto', 'Paga', 'Expirada']

function statusVariant(s) {
  if (s === 'Em aberto') return 'warning'
  if (s === 'Paga' || s === 'Pago') return 'success'
  return 'danger'
}

function statusLabel(s) {
  if (s === 'Pago') return 'Paga'
  return s
}

function formatDate(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

function formatCurrency(v) {
  return `R$ ${Number(v).toFixed(2).replace('.', ',')}`
}


export default function MinhasComandas() {
  const navigate = useNavigate()
  const { salonSlug } = useParams()
  const { user } = useAuthStore()

  const [tabs, setTabs] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('Todos')

  useEffect(() => {
    api.get('/tab')
      .then(({ data }) => setTabs(data.data ?? []))
      .catch(() => setTabs([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = statusFilter === 'Todos'
    ? tabs
    : tabs.filter((t) => {
      if (statusFilter === 'Paga') return t.Status === 'Paga' || t.Status === 'Pago'
      return t.Status === statusFilter
    })

  const emAberto = tabs.filter((t) => t.Status === 'Em aberto').length
  const totalAberto = tabs
    .filter((t) => t.Status === 'Em aberto')
    .reduce((s, t) => s + (t.Value ?? 0), 0)

  const sidebar = <ClienteSidebar user={user} />

  return (
    <AppLayout sidebar={sidebar}>
      {/* Header */}
      <div className="flex justify-between items-end mb-5 md:mb-6">
        <div>
          <h3 className="font-display font-medium text-[22px] md:text-[26px] tracking-tight">Minhas comandas</h3>
          <p className="text-[12px] md:text-[13px] text-ink-3 mt-1">
            {loading ? 'Carregando...' : emAberto > 0
              ? <>{emAberto} em aberto · <MoneyValue>{formatCurrency(totalAberto)}</MoneyValue> a pagar</>
              : 'Nenhuma comanda em aberto'}
          </p>
        </div>
        <NavLink to={`/${salonSlug}/agendar`}>
          <Button size="sm"><Icon name="plus" size={13} />Novo agendamento</Button>
        </NavLink>
      </div>

      {/* Filtros */}
      <div className="flex gap-1.5 mb-5 flex-wrap">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`inline-flex items-center px-3 py-[5px] rounded-full text-xs font-medium border cursor-pointer transition-colors
              ${statusFilter === s ? 'bg-ink text-bg border-ink' : 'bg-surface-2 text-ink-2 border-line hover:border-ink-3'}`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? <PageSpinner /> : tabs.length === 0 ? (
        <EmptyState
          icon="receipt"
          title="Nenhuma comanda ainda"
          description="Suas comandas aparecerão aqui após a conclusão de um atendimento."
          action={() => navigate(`/${salonSlug}/agendar`)}
          actionLabel="Agendar agora"
        />
      ) : filtered.length === 0 ? (
        <div className="flex items-center justify-center h-40 bg-surface border border-line border-dashed rounded-lg text-ink-3 text-[13px]">
          Nenhuma comanda com este filtro
        </div>
      ) : (
        <>
          {/* Tabela — desktop */}
          <div className="hidden md:block bg-surface border border-line rounded-lg overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {['Serviço', 'Profissional', 'Data', 'Valor', 'Status', 'Vencimento'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-mono text-[10.5px] uppercase tracking-widest text-ink-3 border-b border-line-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((tab) => (
                  <tr key={tab.UUID} className="hover:bg-surface-2 transition-colors">
                    <td className="px-4 py-3.5 text-[13px] border-b border-line-2">
                      {tab.Appointment?.Service ?? (tab.Package ? `Compra de pacote: ${tab.Package.Name}` : <span className="text-ink-4">—</span>)}
                    </td>
                    <td className="px-4 py-3.5 text-[13px] text-ink-3 border-b border-line-2">
                      {tab.Appointment?.Professional ?? <span className="text-ink-4">—</span>}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[12px] border-b border-line-2">
                      {tab.Appointment?.Date ? formatDate(tab.Appointment.Date) : formatDate(tab.Created_at)}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[13px] font-medium border-b border-line-2">
                      {tab.Value === 0
                        ? <span className="text-success text-[12px]">Combo</span>
                        : <MoneyValue>{formatCurrency(tab.Value)}</MoneyValue>}
                    </td>
                    <td className="px-4 py-3.5 border-b border-line-2">
                      <Chip variant={statusVariant(tab.Status)}>{statusLabel(tab.Status)}</Chip>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[12px] text-ink-3 border-b border-line-2">
                      {formatDate(tab.Expire_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards — mobile */}
          <div className="flex flex-col gap-2 md:hidden">
            {filtered.map((tab) => (
              <div key={tab.UUID} className="bg-surface border border-line rounded-xl p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[14px] truncate">
                      {tab.Appointment?.Service ?? (tab.Package ? `Compra de pacote: ${tab.Package.Name}` : 'Comanda avulsa')}
                    </div>
                    {tab.Appointment?.Professional && (
                      <div className="text-[12px] text-ink-3 mt-0.5">
                        com {tab.Appointment.Professional}
                      </div>
                    )}
                  </div>
                  <Chip variant={statusVariant(tab.Status)} className="shrink-0">
                    {statusLabel(tab.Status)}
                  </Chip>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-line-2">
                  <span className="font-mono text-[11px] text-ink-3">
                    {tab.Appointment?.Date ? formatDate(tab.Appointment.Date) : formatDate(tab.Created_at)}
                    {tab.Expire_at ? ` · vence ${formatDate(tab.Expire_at)}` : ''}
                  </span>
                  <span className="font-mono text-[13px] font-medium">
                    {tab.Value === 0
                      ? <span className="text-success text-[12px]">Combo</span>
                      : <MoneyValue>{formatCurrency(tab.Value)}</MoneyValue>}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </AppLayout>
  )
}
