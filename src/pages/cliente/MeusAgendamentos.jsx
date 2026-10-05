import { useState, useEffect } from 'react'
import { useNavigate, NavLink, useParams } from 'react-router-dom'
import AppLayout from '@/components/layout/AppLayout'
import ClienteSidebar from '@/components/layout/ClienteSidebar'
import Button from '@/components/ui/Button'
import Chip from '@/components/ui/Chip'
import Icon from '@/components/ui/Icons'
import { PageSpinner } from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'
import useAuthStore from '@/store/authStore'
import api from '@/lib/api'
import { useTour } from '@/hooks/useTour'
import { clienteAgendamentosSteps } from '@/tours/clienteAgendamentosTour'
import { formatDate } from '@/lib/format'


const STATUS_OPTIONS = ['', 'pendente', 'confirmado', 'concluido', 'cancelado']
const STATUS_LABELS = { '': 'Todos', pendente: 'Pendente', confirmado: 'Confirmado', concluido: 'Concluído', cancelado: 'Cancelado' }

const statusStyle = {
  confirmado: 'bg-success-soft text-success',
  pendente: 'bg-warning-soft text-warning',
  concluido: 'bg-surface-2 text-ink-3',
  cancelado: 'bg-danger-soft text-danger',
}


export default function MeusAgendamentos() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const { salonSlug } = useParams()

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const { restartTour } = useTour('cliente_agendamentos', clienteAgendamentosSteps, !loading)
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    if (!user?.id) return
    api.get(`/appointment/client/${user.id}`, { params: { limit: 100 } })
      .then(({ data }) => setItems(data.data ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [user?.id])

  const filtered = statusFilter ? items.filter(i => i.Status === statusFilter) : items

  return (
    <AppLayout sidebar={<ClienteSidebar user={user} />}>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3 mb-5 md:mb-6">
        <div>
          <h3 className="font-display font-medium text-[22px] md:text-[26px] tracking-tight">Meus agendamentos</h3>
          <p className="text-[12px] md:text-[13px] text-ink-3 mt-1">Histórico completo dos seus atendimentos</p>
          <button onClick={restartTour} className="inline-flex items-center gap-1 text-[11px] text-ink-4 hover:text-brand transition-colors mt-1.5" title="Repetir tour guiado">
            <Icon name="helpCircle" size={12} />
            Ver tour
          </button>
        </div>
        <NavLink to={`/${salonSlug}/agendar`}>
          <Button data-tour="agendamentos-novo-cliente" size="sm"><Icon name="plus" size={14} />Novo agendamento</Button>
        </NavLink>
      </div>

      {/* Status filters */}
      <div data-tour="agendamentos-filtro-cliente" className="flex gap-1.5 mb-5 flex-wrap">
        {STATUS_OPTIONS.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`inline-flex items-center px-2.5 py-[4px] rounded-full text-xs font-medium border cursor-pointer transition-colors
              ${statusFilter === s ? 'bg-ink text-bg border-ink' : 'bg-surface-2 text-ink-2 border-line hover:border-ink-3'}`}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <PageSpinner />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="cal"
          title="Nenhum agendamento encontrado"
          description={statusFilter ? 'Não há agendamentos com este status.' : 'Você ainda não tem agendamentos. Que tal marcar um?'}
          action={() => navigate(`/${salonSlug}/agendar`)}
          actionLabel="Agendar agora"
        />
      ) : (
        <>
          {/* Desktop table */}
          <div data-tour="agendamentos-lista-cliente" className="hidden md:block bg-surface border border-line rounded-lg overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {['Data', 'Horário', 'Serviço', 'Profissional', 'Status', ''].map(h => (
                    <th key={h} className="px-3.5 py-3 text-left font-mono text-[10.5px] uppercase tracking-widest text-ink-3 border-b border-line-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(row => (
                  <tr key={row.UUID} className="hover:bg-surface-2 transition-colors">
                    <td className="px-3.5 py-3 font-mono text-[12.5px] border-b border-line-2">{formatDate(row.Date)}</td>
                    <td className="px-3.5 py-3 font-mono text-[12.5px] border-b border-line-2">{row.Start_time?.slice(0,5)} → {row.End_time?.slice(0,5)}</td>
                    <td className="px-3.5 py-3 text-[12.5px] border-b border-line-2">{row.Service ?? '—'}</td>
                    <td className="px-3.5 py-3 text-[12.5px] border-b border-line-2">{row.Professional ?? '—'}</td>
                    <td className="px-3.5 py-3 border-b border-line-2">
                      <Chip status={row.Status} dot>{STATUS_LABELS[row.Status] ?? row.Status}</Chip>
                    </td>
                    <td className="px-3.5 py-3 text-right border-b border-line-2">
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/${salonSlug}/agendamento/${row.UUID}`)}>
                        Detalhes
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-2 md:hidden">
            {filtered.map(row => (
              <div
                key={row.UUID}
                className="bg-surface border border-line rounded-xl p-4 cursor-pointer"
                onClick={() => navigate(`/${salonSlug}/agendamento/${row.UUID}`)}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="font-medium text-[14px] flex-1 min-w-0 truncate">{row.Service ?? '—'}</div>
                  <span className={`inline-flex items-center gap-1 px-2 py-[3px] rounded-full text-[11px] font-medium shrink-0 ${statusStyle[row.Status] ?? ''}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    {STATUS_LABELS[row.Status] ?? row.Status}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[12px] text-ink-3">
                  <span>{formatDate(row.Date)}</span>
                  <span>·</span>
                  <span>{row.Start_time?.slice(0,5)} → {row.End_time?.slice(0,5)}</span>
                </div>
                {row.Professional && (
                  <div className="text-[12px] text-ink-3 mt-0.5">com {row.Professional}</div>
                )}
                <div className="flex justify-end mt-2">
                  <span className="text-[12px] text-brand font-medium flex items-center gap-1">
                    Detalhes <Icon name="chevronRight" size={12} />
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
