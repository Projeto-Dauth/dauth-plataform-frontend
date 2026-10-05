import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AppLayout from '@/components/layout/AppLayout'
import Sidebar from '@/components/layout/Sidebar'
import Button from '@/components/ui/Button'
import Chip from '@/components/ui/Chip'
import Icon from '@/components/ui/Icons'
import { PageSpinner } from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'
import LoadMoreButton from '@/components/ui/LoadMoreButton'
import useAuthStore from '@/store/authStore'
import api from '@/lib/api'
import { navItemsByRole } from '@/config/navItems'
import { usePaginatedList } from '@/hooks/usePaginatedList'
import { useTour } from '@/hooks/useTour'
import { adminAgendamentosSteps } from '@/tours/adminAgendamentosTour'
import { formatDate } from '@/lib/format'

const navItems = navItemsByRole['Admin']

const STATUS_LABELS = { pendente: 'Pendente', confirmado: 'Confirmado', concluido: 'Concluído', cancelado: 'Cancelado' }

const TABS = [
  { id: 'ativos',     label: 'Ativos',     statuses: ['pendente', 'confirmado'] },
  { id: 'concluidos', label: 'Concluídos', statuses: ['concluido'] },
  { id: 'cancelados', label: 'Cancelados', statuses: ['cancelado'] },
]

export default function AdminAgendamentos() {
  const { salonSlug } = useParams()
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const [date, setDate]     = useState('')
  const [search, setSearch] = useState('')
  const [clientName, setClientName] = useState('')
  const [tab, setTab]       = useState('ativos')
  const [counts, setCounts] = useState({})

  useEffect(() => {
    const t = setTimeout(() => setClientName(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const activeTab = TABS.find(t => t.id === tab)

  const { items, loading, loadingMore, hasMore, loadMore } = usePaginatedList(
    (page, limit) => api.get('/appointment', {
      params: { page, limit, status: activeTab.statuses.join(','), date: date || undefined, client_name: clientName || undefined }
    }).then(r => r.data),
    [tab, date, clientName]
  )

  const { restartTour } = useTour('admin_agendamentos', adminAgendamentosSteps, !loading)

  useEffect(() => {
    let cancelled = false
    Promise.all(TABS.map(t =>
      api.get('/appointment', {
        params: { page: 1, limit: 1, status: t.statuses.join(','), date: date || undefined, client_name: clientName || undefined }
      }).then(r => [t.id, r.data.pagination?.total ?? 0])
    )).then(results => {
      if (!cancelled) setCounts(Object.fromEntries(results))
    }).catch(() => {})
    return () => { cancelled = true }
  }, [date, clientName])

  const sidebar = (
    <Sidebar navItems={navItems} footerUser={user?.name} footerRole="Admin">Admin</Sidebar>
  )

  return (
    <AppLayout sidebar={sidebar}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3 mb-5 md:mb-6">
        <div>
          <h3 className="font-display font-medium text-[22px] md:text-[26px] tracking-tight">Agendamentos</h3>
          <p className="text-[12px] md:text-[13px] text-ink-3 mt-1">Gerencie todos os agendamentos do salão</p>
          <button onClick={restartTour} className="inline-flex items-center gap-1 text-[11px] text-ink-4 hover:text-brand transition-colors mt-1.5" title="Repetir tour guiado">
            <Icon name="helpCircle" size={12} />
            Ver tour
          </button>
        </div>
        <Button data-tour="agendamentos-novo" size="sm" onClick={() => navigate(`/${salonSlug}/agendar`)}>
          <Icon name="plus" size={14} />Novo agendamento
        </Button>
      </div>

      {/* Filtros */}
      <div data-tour="agendamentos-filtro" className="flex flex-col sm:flex-row gap-2 sm:items-center mb-4">
        <div className="relative flex-1 max-w-[280px]">
          <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por cliente..."
            className="w-full h-[36px] pl-9 pr-3 rounded-md border border-line bg-surface text-ink-2 text-[13px] placeholder:text-ink-4 focus:outline-none focus:border-brand transition-colors"
          />
        </div>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="h-[36px] px-3 rounded-md border border-line bg-surface text-ink-2 text-[13px] focus:outline-none focus:border-brand transition-colors"
        />
        {date && (
          <button
            onClick={() => setDate('')}
            className="text-[12.5px] text-ink-3 hover:text-ink transition-colors cursor-pointer flex items-center gap-1"
          >
            <Icon name="x" size={12} />Limpar
          </button>
        )}
      </div>

      {/* Tabs */}
      <div data-tour="agendamentos-tabs" className="flex gap-1 mb-5 border-b border-line">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative px-3 pb-2.5 pt-1 text-[13px] font-medium transition-colors cursor-pointer flex items-center gap-1.5
              ${tab === t.id ? 'text-brand' : 'text-ink-3 hover:text-ink'}`}
          >
            {t.label}
            {counts[t.id] > 0 && (
              <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold
                ${tab === t.id ? 'bg-brand text-bg' : 'bg-surface-3 text-ink-3'}`}>
                {counts[t.id]}
              </span>
            )}
            {tab === t.id && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-brand rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <PageSpinner />
      ) : items.length === 0 ? (
        <EmptyState
          icon="cal"
          title={`Nenhum agendamento ${activeTab.label.toLowerCase()}`}
          description={date ? 'Nenhum resultado para a data selecionada.' : 'Nenhum agendamento nesta categoria.'}
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-surface border border-line rounded-lg overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {['Data', 'Horário', 'Cliente', 'Profissional', 'Serviço', 'Status', ''].map(h => (
                    <th key={h} className="px-3.5 py-3 text-left font-mono text-[10.5px] uppercase tracking-widest text-ink-3 border-b border-line-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map(row => (
                  <tr key={row.UUID} className="hover:bg-surface-2 transition-colors">
                    <td className="px-3.5 py-3 font-mono text-[12.5px] border-b border-line-2">{formatDate(row.Date)}</td>
                    <td className="px-3.5 py-3 font-mono text-[12.5px] border-b border-line-2">{row.Start_time?.slice(0, 5)} → {row.End_time?.slice(0, 5)}</td>
                    <td className="px-3.5 py-3 text-[12.5px] border-b border-line-2">{row.Client ?? '—'}</td>
                    <td className="px-3.5 py-3 text-[12.5px] border-b border-line-2">{row.Professional ?? '—'}</td>
                    <td className="px-3.5 py-3 text-[12.5px] border-b border-line-2">{row.Service ?? '—'}</td>
                    <td className="px-3.5 py-3 border-b border-line-2">
                      <Chip status={row.Status} dot>{STATUS_LABELS[row.Status] ?? row.Status}</Chip>
                    </td>
                    <td className="px-3.5 py-3 text-right border-b border-line-2">
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/${salonSlug}/agendamento/${row.UUID}`)}>
                        <Icon name="chevronRight" size={14} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-2 md:hidden">
            {items.map(row => (
              <div
                key={row.UUID}
                className="bg-surface border border-line rounded-xl p-4 cursor-pointer"
                onClick={() => navigate(`/${salonSlug}/agendamento/${row.UUID}`)}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="font-medium text-[14px] flex-1 min-w-0 truncate">{row.Service ?? '—'}</div>
                  <Chip status={row.Status} dot>{STATUS_LABELS[row.Status] ?? row.Status}</Chip>
                </div>
                <div className="text-[12px] text-ink-3 mb-0.5">
                  {formatDate(row.Date)} · {row.Start_time?.slice(0, 5)} → {row.End_time?.slice(0, 5)}
                </div>
                <div className="flex items-center gap-2 text-[12px] text-ink-3">
                  <span>{row.Client ?? '—'}</span>
                  <span>·</span>
                  <span>com {row.Professional ?? '—'}</span>
                </div>
              </div>
            ))}
          </div>

          {hasMore && <LoadMoreButton onClick={loadMore} loading={loadingMore} />}
        </>
      )}
    </AppLayout>
  )
}
