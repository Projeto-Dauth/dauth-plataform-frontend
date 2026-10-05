import { useState, useEffect } from 'react'
import { NavLink, useParams } from 'react-router-dom'
import AppLayout from '@/components/layout/AppLayout'
import Button from '@/components/ui/Button'
import Chip from '@/components/ui/Chip'
import Icon from '@/components/ui/Icons'
import { PageSpinner } from '@/components/ui/Spinner'
import Avatar from '@/components/ui/Avatar'
import ClienteSidebar from '@/components/layout/ClienteSidebar'
import useAuthStore from '@/store/authStore'
import api from '@/lib/api'
import { useTour } from '@/hooks/useTour'
import { clienteSteps } from '@/tours/clienteTour'
import { useToast } from '@/context/ToastContext'
import { formatDate } from '@/lib/format'


const MONTH_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const DOW_FULL = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado']

const statusStyle = {
  confirmado: 'bg-success-soft text-success',
  pendente: 'bg-[#dbeafe] text-[#1d4ed8]',
  concluido: 'bg-surface-2 text-ink-3',
  cancelado: 'bg-danger-soft text-danger',
}
const statusLabel = {
  confirmado: 'Confirmado',
  pendente: 'Pendente',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start gap-4 py-3 border-b border-line-2 last:border-0">
      <div className="w-28 text-[12px] text-ink-3 font-medium shrink-0">{label}</div>
      <div className="text-[13px] text-ink-2">{value ?? '—'}</div>
    </div>
  )
}

function AppointmentPanel({ id, onClose, onCancelled }) {
  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const { addToast } = useToast()

  useEffect(() => {
    if (!id) return
    setLoading(true)
    api.get(`/appointment/${id}`)
      .then(({ data }) => setItem(data.data ?? data))
      .catch(() => setItem(null))
      .finally(() => setLoading(false))
  }, [id])

  async function handleCancel() {
    setCancelling(true)
    try {
      await api.patch(`/appointment/${id}`, { Status: 'cancelado' })
      setItem(prev => ({ ...prev, Status: 'cancelado' }))
      setConfirmCancel(false)
      addToast('Agendamento cancelado.')
      onCancelled?.()
    } catch (err) {
      addToast(err.response?.data?.error ?? 'Erro ao cancelar', 'error')
      setConfirmCancel(false)
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end md:flex-row md:justify-end">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Mobile: bottom sheet — Desktop: side drawer */}
      <div className="relative z-10 w-full rounded-t-2xl md:rounded-none md:w-[420px] bg-bg md:border-l border-line flex flex-col max-h-[85vh] md:max-h-full md:h-full overflow-y-auto shadow-xl">
        {/* Handle mobile */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 rounded-full bg-line-2" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-line sticky top-0 bg-bg z-10">
          <button onClick={onClose} className="text-ink-3 hover:text-ink transition-colors cursor-pointer">
            <Icon name="x" size={18} />
          </button>
          <div className="flex-1">
            <h4 className="font-display font-medium text-[15px] tracking-tight">Detalhes do agendamento</h4>
            {item && <p className="text-[11px] text-ink-3 font-mono">#{item.UUID?.slice(0, 8)}</p>}
          </div>
          {item && <Chip status={item.Status} dot>{statusLabel[item.Status] ?? item.Status}</Chip>}
        </div>

        {loading ? (
          <div className="flex items-center justify-center flex-1 py-16">
            <PageSpinner />
          </div>
        ) : !item ? (
          <div className="flex items-center justify-center flex-1 py-16 text-ink-3 text-[13px]">
            Agendamento não encontrado.
          </div>
        ) : (
          <div className="px-5 py-5 flex flex-col gap-4">
            {/* Info */}
            <div className="bg-surface border border-line rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-line-2">
                <span className="font-mono text-[10.5px] uppercase tracking-widest text-ink-3">Informações</span>
              </div>
              <div className="px-4">
                <InfoRow label="Data" value={formatDate(item.Date)} />
                <InfoRow label="Horário" value={item.Start_time ? `${item.Start_time.slice(0,5)} → ${item.End_time?.slice(0,5)}` : null} />
                <InfoRow label="Serviço" value={item.Service} />
              </div>
            </div>

            {/* Client */}
            <div className="bg-surface border border-line rounded-xl p-4">
              <div className="font-mono text-[10.5px] uppercase tracking-widest text-ink-3 mb-3">Cliente</div>
              <div className="flex items-center gap-3">
                <Avatar name={item.Client ?? '?'} index={0} size="md" />
                <div className="font-medium text-[13.5px]">{item.Client ?? '—'}</div>
              </div>
            </div>

            {/* Professional */}
            <div className="bg-surface border border-line rounded-xl p-4">
              <div className="font-mono text-[10.5px] uppercase tracking-widest text-ink-3 mb-3">Profissional</div>
              <div className="flex items-center gap-3">
                <Avatar name={item.Professional ?? '?'} index={1} size="md" />
                <div className="font-medium text-[13.5px]">{item.Professional ?? '—'}</div>
              </div>
            </div>

            {/* Cancel button */}
            {(item.Status === 'pendente' || item.Status === 'confirmado') && (
              confirmCancel ? (
                <div className="bg-surface border border-danger/30 rounded-xl p-4 flex flex-col gap-3">
                  <p className="text-[13px] text-ink-2 leading-relaxed">
                    Tem certeza que deseja cancelar este agendamento?
                  </p>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="flex-1 justify-center" onClick={() => setConfirmCancel(false)} disabled={cancelling}>
                      Voltar
                    </Button>
                    <Button variant="ghost" size="sm" className="flex-1 justify-center text-danger" onClick={handleCancel} loading={cancelling}>
                      Confirmar cancelamento
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="ghost" size="sm" className="text-danger" onClick={() => setConfirmCancel(true)}>
                  <Icon name="x" size={13} />Cancelar agendamento
                </Button>
              )
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function parseLocalDate(str) {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function daysUntil(dateStr) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = parseLocalDate(dateStr)
  return Math.round((target - today) / 86400000)
}


export default function ClienteDashboard() {
  const { salonSlug } = useParams()
  const { user } = useAuthStore()

  const [loading, setLoading] = useState(true)
  const { restartTour } = useTour('cliente', clienteSteps, !loading)
  const [appointments, setAppointments] = useState([])
  const [combos, setCombos] = useState([])
  const [selectedId, setSelectedId] = useState(null)

  useEffect(() => {
    if (!user?.id) return
    Promise.all([
      api.get(`/appointment/client/${user.id}`),
      api.get('/users/perfil/me'),
      api.get(`/package/client/${user.id}`),
    ])
      .then(([apptRes, perfilRes, combosRes]) => {
        setAppointments(apptRes.data.data ?? [])

        setCombos(combosRes.data.data ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user?.id])

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const upcoming = appointments
    .filter((a) => {
      const d = parseLocalDate(a.Date)
      return (a.Status === 'confirmado' || a.Status === 'pendente') && d >= today
    })
    .sort((a, b) => {
      const diff = parseLocalDate(a.Date) - parseLocalDate(b.Date)
      if (diff !== 0) return diff
      return (a.Start_time ?? '').localeCompare(b.Start_time ?? '')
    })

  const next = upcoming[0] ?? null

  const recent = [...appointments]
    .sort((a, b) => {
      const diff = parseLocalDate(b.Date) - parseLocalDate(a.Date)
      if (diff !== 0) return diff
      return (b.Start_time ?? '').localeCompare(a.Start_time ?? '')
    })
    .slice(0, 5)

  const nextDate = next ? parseLocalDate(next.Date) : null
  const diff = next ? daysUntil(next.Date) : null
  const diffLabel = diff === 0 ? 'hoje' : diff === 1 ? 'amanhã' : diff != null ? `em ${diff} dias` : null

  const firstName = user?.name?.split(' ')[0] ?? ''

  return (
    <AppLayout sidebar={<ClienteSidebar user={user} />}>
      {selectedId && (
        <AppointmentPanel
          id={selectedId}
          onClose={() => setSelectedId(null)}
          onCancelled={() => {
            setAppointments(prev => prev.map(a => a.UUID === selectedId ? { ...a, Status: 'cancelado' } : a))
            setSelectedId(null)
          }}
        />
      )}
      {loading ? (
        <PageSpinner />
      ) : (
        <>
          {/* Topbar */}
          <div className="flex justify-between items-end mb-5 md:mb-7">
            <div>
              <h3 className="font-display font-medium text-[22px] md:text-[26px] tracking-tight">Olá, {firstName}</h3>
              <div className="text-[12px] md:text-[13px] text-ink-3 mt-1">
                {next
                  ? `Seu próximo atendimento é ${diffLabel}`
                  : 'Nenhum atendimento agendado'}
              </div>
              <button onClick={restartTour} className="inline-flex items-center gap-1 text-[11px] text-ink-4 hover:text-brand transition-colors mt-1.5" title="Repetir tour guiado">
                <Icon name="helpCircle" size={12} />
                Ver tour
              </button>
            </div>
          </div>

          {/* Hero grid */}
          <div className="grid grid-cols-1 md:grid-cols-[1.3fr_1fr] gap-4 mb-5 md:mb-6">
            {/* Next appointment */}
            {next ? (
              <div data-tour="next-appointment" className="bg-surface border border-line rounded-2xl p-5 md:p-7 flex gap-5 md:gap-7 items-center relative">
                <div className="text-center pr-5 md:pr-7 border-r border-line-2">
                  <div className="font-display font-medium text-[44px] md:text-[56px] leading-none tracking-tighter">
                    {nextDate.getDate()}
                  </div>
                  <div className="font-mono text-[10px] md:text-[11px] uppercase tracking-widest text-ink-3 mt-1.5">
                    {MONTH_SHORT[nextDate.getMonth()]} · {DOW_FULL[nextDate.getDay()].slice(0, 3)}
                  </div>
                  <div className="font-mono text-[12px] md:text-[14px] mt-2">
                    {next.Start_time?.slice(0, 5)} → {next.End_time?.slice(0, 5)}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-0.5">
                    <div className="font-display font-medium text-[18px] md:text-[22px] tracking-tight truncate flex-1 min-w-0">{next.Service}</div>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-[3px] rounded-full text-xs font-medium shrink-0 ${statusStyle[next.Status]}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {statusLabel[next.Status]}
                    </span>
                  </div>
                  <div className="font-mono text-[11px] md:text-[12px] text-ink-3">com {next.Professional}</div>
                  <div className="flex gap-2 mt-3 md:mt-4">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedId(next.UUID)}>
                      Ver detalhes
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-surface border border-line border-dashed rounded-2xl p-6 md:p-7 flex flex-col items-center justify-center gap-3 text-center">
                <Icon name="cal" size={28} className="text-ink-4" />
                <div className="font-display font-medium text-[16px] md:text-[17px] tracking-tight">Sem agendamentos futuros</div>
                <div className="text-[13px] text-ink-3 max-w-[220px]">Agende um horário e apareça aqui.</div>
                <NavLink to={`/${salonSlug}/agendar`}>
                  <Button size="sm"><Icon name="plus" size={13} />Agendar agora</Button>
                </NavLink>
              </div>
            )}

            {/* Card combos */}
            {combos.length > 0 ? (() => {
              const ativos = combos.filter(c => c.Status === 'ativo' || c.Status === 'pendente')
              const destaque = ativos[0] ?? combos[0]
              const items = destaque.Client_package_items ?? []
              const totalSessions = items.reduce((s, i) => s + i.Total_quantity, 0)
              const usedSessions = items.reduce((s, i) => s + i.Used_quantity, 0)
              const remaining = totalSessions - usedSessions
              const pct = totalSessions > 0 ? Math.min((usedSessions / totalSessions) * 100, 100) : 0
              return (
                <div data-tour="combos-card" className="rounded-2xl p-5 md:p-6 border border-line bg-surface flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-widest text-brand">
                        <Icon name="package" size={12} />Pacotes e combos
                      </div>
                      {ativos.length > 0 && (
                        <span className="font-mono text-[10.5px] bg-success-soft text-success px-2 py-0.5 rounded-full">
                          {ativos.length} ativo{ativos.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <h4 className="font-display font-medium text-[17px] md:text-[18px] tracking-tight mb-0.5">
                      {destaque.Service_package?.Name ?? '—'}
                    </h4>
                    <div className="text-[12px] md:text-[12.5px] text-ink-3 mb-4">
                      {remaining} sessão{remaining !== 1 ? 'ões' : ''} restante{remaining !== 1 ? 's' : ''} de {totalSessions}
                    </div>
                    <div className="h-1.5 bg-line rounded-full overflow-hidden mb-1">
                      <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex flex-col gap-1.5 mt-3">
                      {items.map(item => (
                        <div key={item.UUID} className="flex items-center justify-between text-[12px]">
                          <span className="text-ink-2">{item.Service?.Name ?? '—'}</span>
                          <span className="font-mono text-ink-3">{item.Total_quantity - item.Used_quantity} / {item.Total_quantity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-4 md:mt-5">
                    <NavLink to={`/${salonSlug}/cliente/combos`}>
                      <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md font-medium text-[13px] bg-brand text-white cursor-pointer hover:bg-brand-dark transition-colors">
                        <Icon name="package" size={13} />Ver meus combos
                      </button>
                    </NavLink>
                  </div>
                </div>
              )
            })() : (
              <div
                className="rounded-2xl p-5 md:p-6 border border-line flex flex-col justify-between"
                style={{ background: 'linear-gradient(135deg, #f1e3d6 0%, #f4e9d6 100%)' }}
              >
                <div>
                  <div className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-widest text-brand mb-2.5">
                    <Icon name="package" size={12} />Pacotes e combos
                  </div>
                  <h4 className="font-display font-medium text-[18px] md:text-[20px] tracking-tight mb-1.5">
                    Economize com combos
                  </h4>
                  <div className="text-[12px] md:text-[12.5px] text-ink-2">
                    Compre sessões em pacote e pague menos em cada atendimento.
                  </div>
                </div>
                <div className="mt-5">
                  <div className="font-mono text-[11px] text-ink-3">
                    Converse com a equipe sobre combos disponíveis.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* History header */}
          <div className="flex justify-between items-end mb-3">
            <h4 className="font-display font-medium text-[16px] md:text-[18px] tracking-tight">Histórico recente</h4>
            <NavLink to={`/${salonSlug}/cliente/agendamentos`}>
              <Button variant="ghost" size="sm">Ver todos <Icon name="arrowRight" size={13} /></Button>
            </NavLink>
          </div>

          {/* History — table on md+, cards on mobile */}
          {recent.length === 0 ? (
            <div className="flex items-center justify-center h-32 bg-surface border border-line border-dashed rounded-lg text-ink-3 text-[13px]">
              Nenhum agendamento ainda
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block bg-surface border border-line rounded-lg overflow-hidden">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      {['Data', 'Serviço', 'Profissional', 'Status', ''].map((h) => (
                        <th key={h} className="px-3.5 py-3 text-left font-mono text-[10.5px] uppercase tracking-widest text-ink-3 border-b border-line-2">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((row) => (
                      <tr key={row.UUID} className="hover:bg-surface-2 transition-colors">
                        <td className="px-3.5 py-3 font-mono text-[12.5px] border-b border-line-2">
                          {row.Date ? `${row.Date.slice(8,10)}/${row.Date.slice(5,7)} · ${row.Start_time?.slice(0,5)}` : '—'}
                        </td>
                        <td className="px-3.5 py-3 text-[12.5px] border-b border-line-2">{row.Service ?? '—'}</td>
                        <td className="px-3.5 py-3 text-[12.5px] border-b border-line-2">{row.Professional ?? '—'}</td>
                        <td className="px-3.5 py-3 border-b border-line-2">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-[3px] rounded-full text-xs font-medium ${statusStyle[row.Status] ?? ''}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {statusLabel[row.Status] ?? row.Status}
                          </span>
                        </td>
                        <td className="px-3.5 py-3 text-right border-b border-line-2">
                          <Button variant="ghost" size="sm" onClick={() => setSelectedId(row.UUID)}>
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
                {recent.map((row) => (
                  <div
                    key={row.UUID}
                    className="bg-surface border border-line rounded-xl p-4 flex items-center gap-3 cursor-pointer"
                    onClick={() => setSelectedId(row.UUID)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-[14px] truncate">{row.Service ?? '—'}</div>
                      <div className="text-[12px] text-ink-3 mt-0.5">
                        {row.Date ? `${row.Date.slice(8,10)}/${row.Date.slice(5,7)} · ${row.Start_time?.slice(0,5)}` : '—'}
                        {row.Professional ? ` · ${row.Professional}` : ''}
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-[3px] rounded-full text-[11px] font-medium shrink-0 ${statusStyle[row.Status] ?? ''}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {statusLabel[row.Status] ?? row.Status}
                    </span>
                    <Icon name="chevronRight" size={14} className="text-ink-4 shrink-0" />
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </AppLayout>
  )
}
