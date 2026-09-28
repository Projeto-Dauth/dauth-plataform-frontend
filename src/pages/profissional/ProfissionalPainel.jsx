import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AppLayout from '@/components/layout/AppLayout'
import Sidebar from '@/components/layout/Sidebar'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Chip from '@/components/ui/Chip'
import Icon from '@/components/ui/Icons'
import { PageSpinner } from '@/components/ui/Spinner'
import useAuthStore from '@/store/authStore'
import api from '@/lib/api'
import { navItemsByRole } from '@/config/navItems'

const navItems = navItemsByRole['Profissional']

const DOW_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTH_NAMES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
const DOW_FULL = ['domingo','segunda','terça','quarta','quinta','sexta','sábado']

const STATUS_CHIP = {
  confirmado: 'bg-success-soft text-success',
  pendente:   'bg-warning-soft text-warning',
  concluido:  'bg-surface-2 text-ink-3',
  cancelado:  'bg-danger-soft text-danger',
}

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function parseTime(t) { return t.slice(0, 5) }

function toMins(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function nowMins() {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

function formatHour(t) { return t.slice(0, 5) }

export default function ProfissionalPainel() {
  const { salonSlug } = useParams()
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const [appointments, setAppointments] = useState([])
  const [workingHours, setWorkingHours] = useState([])
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(nowMins())

  const today = new Date()
  const todayStr = toDateStr(today)

  useEffect(() => {
    if (!user?.id) return

    Promise.all([
      api.get('/appointment/my', { params: { date: todayStr } }),
      api.get(`/working-hours/professional/${user.id}`),
      api.get('/service', { params: { limit: 100 } }),
    ])
      .then(async ([apptRes, whRes, svcRes]) => {
        setAppointments(apptRes.data.data ?? [])
        setWorkingHours(whRes.data.data ?? [])
        const allServices = svcRes.data.data ?? []
        const profsPerService = await Promise.all(
          allServices.map((s) =>
            api.get(`/service/${s.UUID}/professionals`)
              .then(({ data }) => data.data ?? [])
              .catch(() => [])
          )
        )
        setServices(allServices.filter((_, i) =>
          profsPerService[i].some((p) => p.professional_id === user.id)
        ))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user?.id])

  // Atualiza "agora" a cada minuto
  useEffect(() => {
    const t = setInterval(() => setNow(nowMins()), 60_000)
    return () => clearInterval(t)
  }, [])

  // Appointment em andamento agora
  const current = appointments.find((a) => {
    const start = toMins(parseTime(a.Start_time))
    const end   = toMins(parseTime(a.End_time))
    return now >= start && now < end && a.Status !== 'cancelado'
  })

  // Próximos: após o horário atual, excluindo o current e cancelados
  const upcoming = appointments
    .filter((a) => toMins(parseTime(a.Start_time)) > now && a.Status !== 'cancelado')
    .sort((a, b) => toMins(parseTime(a.Start_time)) - toMins(parseTime(b.Start_time)))

  // Horários da semana indexados por weekday
  const whByDay = Object.fromEntries(workingHours.map((w) => [w.Weekday, w]))

  const headerDate = `${DOW_FULL[today.getDay()].charAt(0).toUpperCase() + DOW_FULL[today.getDay()].slice(1)}, ${today.getDate()} de ${MONTH_NAMES[today.getMonth()]}`

  const sidebar = (
    <Sidebar navItems={navItems} footerUser={user?.name} footerRole="Profissional" />
  )

  if (loading) return (
    <AppLayout sidebar={sidebar}>
      <div className="flex justify-between items-end mb-7">
        <div className="flex flex-col gap-2">
          <div className="h-7 w-56 bg-surface-2 rounded-lg animate-pulse" />
          <div className="h-4 w-36 bg-surface-2 rounded animate-pulse" />
        </div>
        <div className="h-8 w-36 bg-surface-2 rounded-lg animate-pulse" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-3.5 mb-5">
        <div className="rounded-2xl p-7 animate-pulse" style={{ background: '#2a1e18', opacity: 0.6 }}>
          <div className="h-3 w-32 bg-white/20 rounded mb-4" />
          <div className="h-9 w-48 bg-white/20 rounded mb-2" />
          <div className="h-4 w-36 bg-white/20 rounded mb-7" />
          <div className="h-9 w-28 bg-white/20 rounded" />
        </div>
        <div className="bg-surface border border-line rounded-2xl p-6">
          <div className="flex justify-between items-center mb-4">
            <div className="h-5 w-20 bg-surface-2 rounded animate-pulse" />
            <div className="h-6 w-20 bg-surface-2 rounded-full animate-pulse" />
          </div>
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-3 border-b border-line-2 last:border-0">
                <div className="h-4 w-10 bg-surface-2 rounded animate-pulse" />
                <div className="w-7 h-7 rounded-full bg-surface-2 animate-pulse shrink-0" />
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className="h-3.5 w-28 bg-surface-2 rounded animate-pulse" />
                  <div className="h-3 w-20 bg-surface-2 rounded animate-pulse" />
                </div>
                <div className="h-5 w-16 bg-surface-2 rounded-full animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <div className="bg-surface border border-line rounded-[14px] p-5">
          <div className="h-5 w-32 bg-surface-2 rounded animate-pulse mb-4" />
          <div className="flex flex-col gap-1.5 md:hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-9 bg-surface-2 rounded-[10px] animate-pulse" />
            ))}
          </div>
          <div className="hidden md:grid grid-cols-7 gap-1.5">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="py-2.5 px-1 bg-surface-2 rounded-[10px] animate-pulse h-14" />
            ))}
          </div>
        </div>
        <div className="bg-surface border border-line rounded-[14px] p-5">
          <div className="h-5 w-28 bg-surface-2 rounded animate-pulse mb-4" />
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-7 rounded-full bg-surface-2 animate-pulse" style={{ width: `${[80, 100, 72, 90][i]}px` }} />
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  )

  return (
    <AppLayout sidebar={sidebar}>
      {/* Header */}
      <div className="flex justify-between items-end mb-7">
        <div>
          <h3 className="font-display font-medium text-[26px] tracking-tight">{headerDate}</h3>
          <div className="text-[13px] text-ink-3 mt-1">
            {appointments.length} atendimento{appointments.length !== 1 ? 's' : ''} hoje
            {upcoming.length > 0 && ` · próximo às ${formatHour(upcoming[0].Start_time)}`}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate(`/${salonSlug}/profissional/agendamentos`)}>
          <Icon name="receipt" size={14} />Ver agenda completa
        </Button>
      </div>

      {/* KPIs do dia */}
      {(() => {
        const total = appointments.length
        const concluidos = appointments.filter(a => a.Status === 'concluido').length
        const pendentes = appointments.filter(a => a.Status === 'pendente').length
        const confirmados = appointments.filter(a => a.Status === 'confirmado').length
        return (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-surface border border-line rounded-xl px-4 py-3.5">
              <div className="font-mono text-[10px] uppercase tracking-widest text-ink-4 mb-1">Total hoje</div>
              <div className="font-serif font-light text-[26px] leading-none tracking-wide">{total}</div>
            </div>
            <div className="bg-surface border border-line rounded-xl px-4 py-3.5">
              <div className="font-mono text-[10px] uppercase tracking-widest text-ink-4 mb-1">Concluídos</div>
              <div className="font-serif font-light text-[26px] leading-none tracking-wide text-success">{concluidos}</div>
            </div>
            <div className="bg-surface border border-line rounded-xl px-4 py-3.5">
              <div className="font-mono text-[10px] uppercase tracking-widest text-ink-4 mb-1">A atender</div>
              <div className="font-serif font-light text-[26px] leading-none tracking-wide text-warning">{pendentes + confirmados}</div>
            </div>
          </div>
        )
      })()}

      {/* Now + Next grid */}
      <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-3.5 mb-5">

        {/* Card Agora */}
        <div className="rounded-2xl p-7 relative overflow-hidden" style={{ background: '#2a1e18' }}>
          <div className="absolute pointer-events-none" style={{
            right: -40, top: -40, width: 220, height: 220, borderRadius: '50%',
            background: 'radial-gradient(circle, #8b4a2b 0%, transparent 70%)', opacity: 0.4,
          }} />

          {current ? (
            <>
              <div className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-widest text-gold">
                <span className="w-2 h-2 rounded-full bg-gold animate-pulse" />
                Agora atendendo · {formatHour(current.Start_time)} — {formatHour(current.End_time)}
              </div>
              <div className="font-display font-medium text-[34px] tracking-tight mt-2.5 mb-1 text-[#f4ece1]">
                {current.Client}
              </div>
              <div className="font-mono text-[12.5px]" style={{ color: 'rgba(244,236,225,0.7)' }}>
                {current.Service}
              </div>
              <div className="flex gap-2.5 mt-7">
                <button
                  onClick={() => navigate(`/${salonSlug}/agendamento/${current.UUID}`)}
                  className="inline-flex items-center gap-2 px-4 py-[10px] rounded-md font-medium text-md cursor-pointer transition-colors"
                  style={{ background: '#c9a57b', color: '#2a1e18', border: '1px solid #c9a57b' }}
                >
                  <Icon name="check" size={14} />Ver detalhes
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="font-mono text-[11px] uppercase tracking-widest text-gold mb-3">
                Agora
              </div>
              <div className="font-display font-medium text-[28px] tracking-tight text-[#f4ece1] mb-2">
                Livre no momento
              </div>
              <div className="font-mono text-[12.5px]" style={{ color: 'rgba(244,236,225,0.5)' }}>
                {upcoming.length > 0
                  ? `Próximo atendimento às ${formatHour(upcoming[0].Start_time)} — ${upcoming[0].Client}`
                  : 'Nenhum atendimento agendado para hoje'}
              </div>
            </>
          )}
        </div>

        {/* Card A seguir */}
        <div className="bg-surface border border-line rounded-2xl p-6 flex flex-col">
          <h4 className="font-display font-medium text-base flex justify-between items-center mb-4">
            A seguir
            <Chip variant="brand">{upcoming.length} restante{upcoming.length !== 1 ? 's' : ''}</Chip>
          </h4>

          {upcoming.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-[13px] text-ink-3">
              Sem mais atendimentos hoje
            </div>
          ) : (
            <div className="flex flex-col overflow-y-auto">
              {upcoming.map((appt, idx) => (
                <button
                  key={appt.UUID}
                  onClick={() => navigate(`/${salonSlug}/agendamento/${appt.UUID}`)}
                  className="flex gap-3.5 items-center py-3 border-b border-line-2 last:border-b-0 text-left hover:bg-surface-2 -mx-2 px-2 rounded transition-colors"
                >
                  <div className="font-mono text-[12.5px] text-ink-2 min-w-[42px] font-medium">
                    {formatHour(appt.Start_time)}
                  </div>
                  <Avatar name={appt.Client} index={idx} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-medium truncate">{appt.Client}</div>
                    <div className="font-mono text-[11px] text-ink-3 truncate">{appt.Service}</div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-[3px] rounded-full text-xs font-medium flex-shrink-0 ${STATUS_CHIP[appt.Status]}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    {appt.Status.charAt(0).toUpperCase() + appt.Status.slice(1)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">

        {/* Meus horários */}
        <Card>
          <div className="flex justify-between items-end mb-4">
            <h4 className="font-display font-medium text-[18px] tracking-tight">Meus horários</h4>
          </div>
          {workingHours.length === 0 ? (
            <div className="text-[13px] text-ink-3 py-4 text-center">Nenhum horário cadastrado</div>
          ) : (
            <>
              {/* Mobile: lista compacta */}
              <div className="flex flex-col gap-1.5 md:hidden">
                {DOW_LABELS.map((label, idx) => {
                  const wh = whByDay[idx]
                  if (!wh) return null
                  return (
                    <div key={label} className="flex items-center justify-between px-3 py-2 bg-surface-2 rounded-[10px] border border-line-2">
                      <span className="font-mono text-[11px] uppercase tracking-widest text-ink-3">{label}</span>
                      <span className="font-mono text-[12px] font-medium text-ink-2">
                        {wh.Start_time.slice(0,5)} – {wh.End_time.slice(0,5)}
                      </span>
                    </div>
                  )
                })}
              </div>
              {/* Desktop: grade de 7 colunas */}
              <div className="hidden md:grid grid-cols-7 gap-1.5">
                {DOW_LABELS.map((label, idx) => {
                  const wh = whByDay[idx]
                  return (
                    <div
                      key={label}
                      className={`py-2.5 px-1 text-center bg-surface-2 rounded-[10px] border border-line-2
                        ${!wh ? 'opacity-40' : ''}`}
                    >
                      <div className="font-mono text-[10px] uppercase tracking-widest text-ink-3">{label}</div>
                      <div className="font-mono text-[11px] mt-1.5 font-medium text-ink-2">
                        {wh ? `${wh.Start_time.slice(0,5)}–${wh.End_time.slice(0,5)}` : '—'}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </Card>

        {/* Meus serviços */}
        <Card>
          <div className="flex justify-between items-end mb-4">
            <h4 className="font-display font-medium text-[18px] tracking-tight">
              Serviços · {services.length}
            </h4>
          </div>
          {services.length === 0 ? (
            <div className="text-[13px] text-ink-3 py-4 text-center">Nenhum serviço vinculado</div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {services.map((s) => (
                <span
                  key={s.UUID}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium bg-surface-2 text-ink-2 border border-line"
                >
                  {s.Name}
                  {s.Price > 0 && (
                    <span className="font-mono text-[11px] text-ink-3">
                      · R$ {Number(s.Price).toFixed(0)}
                    </span>
                  )}
                </span>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  )
}
