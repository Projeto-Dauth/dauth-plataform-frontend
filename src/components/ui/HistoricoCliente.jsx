import { useState, useEffect } from 'react'
import Icon from '@/components/ui/Icons'
import Button from '@/components/ui/Button'
import Chip from '@/components/ui/Chip'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { formatDate, formatTime } from '@/lib/format'

const MAX_VISITS = 5

// Atendimento combinado = N Appointments com o mesmo Booking_group; para a cliente é uma
// visita só, então vira um item com os serviços juntos.
function groupVisits(appointments) {
  const visits = new Map()
  for (const a of appointments) {
    const key = a.Booking_group ?? a.UUID
    let visit = visits.get(key)
    if (!visit) {
      visit = { key, group: a.Booking_group, date: a.Date, start: a.Start_time, ids: [], statuses: [], services: [], professionals: [], notes: [] }
      visits.set(key, visit)
    }
    visit.ids.push(a.UUID)
    visit.statuses.push(a.Status)
    if (a.Start_time < visit.start) visit.start = a.Start_time
    const services = a.Services?.length ? a.Services : (a.Service ? [{ Name: a.Service }] : [])
    for (const s of services) if (s.Name && !visit.services.includes(s.Name)) visit.services.push(s.Name)
    if (a.Professional && !visit.professionals.includes(a.Professional)) visit.professionals.push(a.Professional)
    if (a.Notes?.trim()) visit.notes.push({ professional: a.Professional, text: a.Notes.trim() })
  }
  return [...visits.values()].map(v => ({ ...v, status: visitStatus(v.statuses) }))
}

const GRID = 'grid grid-cols-[100px_1.4fr_1fr_1fr_110px_160px] gap-x-4'

const STATUS_LABEL = { pendente: 'Pendente', confirmado: 'Confirmado', concluido: 'Concluído', cancelado: 'Cancelado' }

// Visita combinada: vale o status do membro menos avançado, ignorando os cancelados.
function visitStatus(statuses) {
  const active = statuses.filter(s => s !== 'cancelado')
  if (active.length === 0) return 'cancelado'
  return ['pendente', 'confirmado'].find(s => active.includes(s)) ?? 'concluido'
}

// Comanda da visita: pelo agendamento ou pelo Booking_group. Cancelado não gera cobrança.
function findTab(visit, tabs) {
  if (visit.status === 'cancelado') return null
  return tabs.find(t => visit.ids.includes(t.Appointment?.UUID) || (visit.group && t.Booking_group === visit.group)) ?? null
}

function productsText(tab) {
  return tab?.Products?.map(p => p.Quantity > 1 ? `${p.Name} × ${p.Quantity}` : p.Name).join(', ') ?? ''
}

function Notes({ notes }) {
  return notes.map((n, i) => (
    <div key={i} className="mt-1.5 text-[12.5px] text-ink-2 bg-surface-2 rounded-md px-2 py-1 whitespace-pre-wrap">
      {notes.length > 1 && n.professional ? <span className="text-ink-3">{n.professional}: </span> : null}
      {n.text}
    </div>
  ))
}

function Field({ label, children }) {
  return (
    <>
      <dt className="font-mono text-[10px] uppercase tracking-widest text-ink-3">{label}</dt>
      <dd className="text-ink-2 min-w-0">{children}</dd>
    </>
  )
}

function PaymentChip({ tab }) {
  if (tab?.Status === 'Paga') return <Chip variant="success">Pago</Chip>
  if (tab?.Status === 'Em aberto') return <Chip variant="warning">Pagamento em aberto</Chip>
  return null
}

// `exclude`: [{ date, start, group }] — a(s) visita(s) da própria comanda, que não são histórico.
// O histórico só é buscado quando o usuário abre o popup.
export default function HistoricoCliente({ clientId, exclude = [] }) {
  const { can } = usePermission()
  const allowed = can('Agenda', 'view')
  const [open, setOpen] = useState(false)
  const [appointments, setAppointments] = useState(null)
  const [tabs, setTabs] = useState([])

  useEffect(() => {
    if (!open || !clientId) return
    let cancelled = false
    setAppointments(null)
    // Todos os status; a comanda (produtos + pagamento) é opcional — quem só tem Agenda, sem
    // Caixa, recebe 403 em /tab/client e ainda vê os atendimentos.
    Promise.all([
      api.get(`/appointment/client/${clientId}`, { params: { limit: 40 } }),
      api.get(`/tab/client/${clientId}`, { params: { limit: 100 } }).catch(() => null),
    ])
      .then(([apptRes, tabRes]) => {
        if (cancelled) return
        setAppointments(apptRes.data.data ?? [])
        setTabs(tabRes?.data.data ?? [])
      })
      .catch(() => { if (!cancelled) { setAppointments([]); setTabs([]) } })
    return () => { cancelled = true }
  }, [open, clientId])

  if (!clientId || !allowed) return null

  const isCurrent = (v) => exclude.some(e =>
    (e.group && e.group === v.group) || (e.date === v.date && e.start && e.start.slice(0, 5) === v.start.slice(0, 5))
  )
  const visits = appointments ? groupVisits(appointments).filter(v => !isCurrent(v)).slice(0, MAX_VISITS) : null
  const rows = visits?.map(v => ({ v, tab: findTab(v, tabs) }))

  return (
    <>
      <Button variant="outline" size="md" className="w-full justify-center !border-brand !text-brand hover:!bg-brand-soft" onClick={() => setOpen(true)}>
        <Icon name="clock" size={14} />
        Ver histórico
      </Button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative bg-surface rounded-xl p-6 w-full max-w-sm md:max-w-4xl max-h-[80vh] flex flex-col shadow-md border border-line mx-4">
            <div className="flex items-start justify-between gap-3 mb-4 shrink-0">
              <h3 className="font-display font-medium text-lg tracking-tight">Histórico da cliente</h3>
              <button onClick={() => setOpen(false)} className="text-ink-3 hover:text-ink transition-colors mt-0.5 cursor-pointer">
                <Icon name="x" size={16} />
              </button>
            </div>
            <div className="overflow-y-auto scrollbar-hidden min-h-0">
              {visits === null ? (
                <div className="space-y-3 animate-pulse">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="space-y-1.5">
                      <div className="h-3 w-24 rounded bg-line" />
                      <div className="h-3 w-40 rounded bg-line" />
                    </div>
                  ))}
                </div>
              ) : visits.length === 0 ? (
                <div className="text-[13px] text-ink-3">Nenhum atendimento anterior.</div>
              ) : (
                <>
                  {/* Desktop: tabela */}
                  <div className="hidden md:block text-[13px]">
                    <div className={`${GRID} px-3 pb-2 border-b border-line font-mono text-[10.5px] uppercase tracking-widest text-ink-3`}>
                      <div>Data / hora</div>
                      <div>Serviço</div>
                      <div>Profissional</div>
                      <div>Produtos</div>
                      <div>Atendimento</div>
                      <div>Pagamento</div>
                    </div>
                    {rows.map(({ v, tab }) => (
                      <div key={v.key} className="px-3 py-3 border-b border-line last:border-b-0">
                        <div className={`${GRID} items-center`}>
                          <div className="font-mono text-[12px] text-ink-2">{formatDate(v.date)}<br /><span className="text-ink-3">{formatTime(v.start)}</span></div>
                          <div className="text-ink-2 font-medium">{v.services.join(' + ') || '—'}</div>
                          <div className="text-ink-2">{v.professionals.join(', ') || '—'}</div>
                          <div className="text-ink-2">{productsText(tab) || '—'}</div>
                          <div><Chip status={v.status}>{STATUS_LABEL[v.status]}</Chip></div>
                          <div>{tab ? <PaymentChip tab={tab} /> : <span className="text-ink-4">—</span>}</div>
                        </div>
                        <Notes notes={v.notes} />
                      </div>
                    ))}
                  </div>

                  {/* Mobile: um cartão por visita */}
                  <div className="md:hidden space-y-4">
                    {rows.map(({ v, tab }) => (
                      <div key={v.key} className="text-[13px] rounded-lg border border-line p-3">
                        <div className="font-mono text-[11px] text-ink-3 mb-2">
                          {formatDate(v.date)} · {formatTime(v.start)}
                        </div>
                        <dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-1.5 items-baseline">
                          <Field label="Serviço"><span className="font-medium">{v.services.join(' + ') || '—'}</span></Field>
                          <Field label="Profissional">{v.professionals.join(', ') || '—'}</Field>
                          <Field label="Produtos">{productsText(tab) || '—'}</Field>
                          <Field label="Atendimento"><Chip status={v.status}>{STATUS_LABEL[v.status]}</Chip></Field>
                          <Field label="Pagamento">{tab ? <PaymentChip tab={tab} /> : '—'}</Field>
                        </dl>
                        <Notes notes={v.notes} />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
