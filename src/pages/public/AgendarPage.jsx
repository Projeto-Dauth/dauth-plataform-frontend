import { useState, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'
import Icon from '@/components/ui/Icons'
import Modal from '@/components/ui/Modal'
import { useToast } from '@/context/ToastContext'
import useAuthStore from '@/store/authStore'
import useSalonStore from '@/store/salonStore'
import api from '@/lib/api'
import platformApi from '@/lib/platformApi'
import logo from '@/logo-dauth-agendamentos.png'

const STEPS = ['Serviço', 'Profissional', 'Data e hora', 'Seus dados', 'Confirmar']
const DOWS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function formatDuration(duration) {
  let totalMin = typeof duration === 'number' ? duration : (() => { const [h, m] = String(duration).split(':').map(Number); return h * 60 + (m ?? 0) })()
  const h = Math.floor(totalMin / 60), m = totalMin % 60
  if (h > 0 && m > 0) return `${h}h ${m}min`
  if (h > 0) return `${h}h`
  return `${m}min`
}

function formatPrice(price) {
  if (!price || price === 0) return 'Consultar'
  return `R$ ${price.toFixed(2).replace('.', ',')}`
}

// Preço de exibição no passo 1 (escolha de serviço) — "a partir de" o menor preço entre
// os profissionais que atendem o serviço (Min_price, calculado no backend a partir de
// ServiceProfessional.Price_override); cada profissional pode cobrar diferente, então o
// valor exato só é confirmado no passo 2, ao escolher quem vai atender.
function formatFromPrice(minPrice) {
  if (!minPrice || minPrice === 0) return 'Consultar'
  return `A partir de R$ ${minPrice.toFixed(2).replace('.', ',')}`
}

function buildCalendar(year, month) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  return cells
}

export default function AgendarPage() {
  const navigate = useNavigate()
  const { salonSlug } = useParams()
  const { addToast } = useToast()
  const { isAuthenticated, user, login } = useAuthStore()
  const { salon, setSalon } = useSalonStore()

  const [step, setStep] = useState(0)

  // Step 0
  const [services, setServices] = useState([])
  const [categories, setCategories] = useState(['Todas'])
  const [activeCategory, setActiveCategory] = useState('Todas')
  const [loadingServices, setLoadingServices] = useState(true)
  const [serviceSearch, setServiceSearch] = useState('')

  // Step 1
  const [professionals, setProfessionals] = useState([])
  const [loadingProfs, setLoadingProfs] = useState(false)

  // Step 2
  const today = new Date()
  const [calYear, setCalYear] = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth())
  const [selectedDay, setSelectedDay] = useState(null)
  const [slots, setSlots] = useState([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [slotsMessage, setSlotsMessage] = useState('')

  // Step 3
  const [authMode, setAuthMode] = useState('login')
  const [authLoading, setAuthLoading] = useState(false)
  const [loginData, setLoginData] = useState({ phone: '', password: '' })
  const [registerData, setRegisterData] = useState({ name: '', phone: '', birthday: '', password: '' })
  const [registered, setRegistered] = useState(false)

  // Seleções
  const [selectedServiceId, setSelectedServiceId] = useState(null)
  const [selectedProf, setSelectedProf] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)

  // Step 4
  const [confirming, setConfirming] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [sameDayConflict, setSameDayConflict] = useState(null)

  const svc = services.find((s) => s.UUID === selectedServiceId)

  useEffect(() => {
    api.get('/public/services?has_professionals=true')
      .then(({ data }) => {
        setServices(data.data)
        const cats = ['Todas', ...new Set(data.data.map((s) => s.Category).filter(Boolean))]
        setCategories(cats)
      })
      .catch(() => addToast('Erro ao carregar serviços', 'error'))
      .finally(() => setLoadingServices(false))
  }, [])

  useEffect(() => {
    if (step !== 1 || !selectedServiceId) return
    setLoadingProfs(true)
    setProfessionals([])
    setSelectedProf(null)
    api.get(`/public/services/${selectedServiceId}/professionals`)
      .then(({ data }) => setProfessionals(data.data))
      .catch(() => addToast('Erro ao carregar profissionais', 'error'))
      .finally(() => setLoadingProfs(false))
  }, [step, selectedServiceId])

  useEffect(() => {
    if (step !== 2) return
    if (!selectedDay || !selectedProf || !selectedServiceId) return
    setSlots([])
    setSlotsMessage('')
    setSelectedSlot(null)
    setLoadingSlots(true)
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`
    api.get(`/public/availability/${selectedProf.professional_id}?date=${dateStr}&service_id=${selectedServiceId}`)
      .then(({ data }) => {
        setSlots(data.data || [])
        if (data.message) setSlotsMessage(data.message)
      })
      .catch(() => addToast('Erro ao buscar horários', 'error'))
      .finally(() => setLoadingSlots(false))
  }, [step, selectedDay, calYear, calMonth])

  useEffect(() => {
    if (step !== 3 || !isAuthenticated) return
    if (user?.publicId) { setStep(4); return }
    platformApi.post('/salon/join', {}, { headers: { 'x-salon-id': salon?.id } })
      .then(({ data }) => {
        login({ ...user, publicId: data.memberId, role: data.role })
        setSalon(salon, data.role, data.memberId)
        setStep(4)
      })
      .catch(() => setStep(4))
  }, [step, isAuthenticated])

  // Restaurar agendamento pendente a partir dos query params da URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sid = params.get('sid')
    if (!sid) return
    setSelectedServiceId(sid)
    setSelectedProf({ professional_id: params.get('prof_id'), name: params.get('prof_name') })
    setSelectedDay(Number(params.get('day')))
    setCalMonth(Number(params.get('month')))
    setCalYear(Number(params.get('year')))
    setSelectedSlot({ start_time: params.get('start'), end_time: params.get('end') })
    window.history.replaceState({}, '', salonSlug ? `/${salonSlug}/agendar` : '/agendar')
    if (isAuthenticated) {
      if (user?.publicId) { setStep(4) } else { setStep(3) }
    }
  }, [])

  function isDayPast(d) {
    const cell = new Date(calYear, calMonth, d)
    cell.setHours(0, 0, 0, 0)
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    return cell < now
  }

  function prevMonth() {
    if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1) }
    else setCalMonth((m) => m - 1)
    setSelectedDay(null); setSlots([]); setSlotsMessage(''); setSelectedSlot(null)
  }

  function nextMonth() {
    if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1) }
    else setCalMonth((m) => m + 1)
    setSelectedDay(null); setSlots([]); setSlotsMessage(''); setSelectedSlot(null)
  }

  const calDays = buildCalendar(calYear, calMonth)

  const canContinue = [
    selectedServiceId !== null,
    selectedProf !== null,
    selectedDay !== null && selectedSlot !== null,
    isAuthenticated,
    true,
  ][step]

  function next() { if (step < 4) setStep((s) => s + 1) }
  function back() {
    if (step > 0) setStep((s) => (s === 4 && isAuthenticated ? s - 2 : s - 1))
  }

  const serviceSearch_ = serviceSearch.trim().toLowerCase()
  const filteredServices = (activeCategory === 'Todas'
    ? services
    : services.filter((s) => s.Category === activeCategory)
  ).filter((s) => !serviceSearch_ || s.Name.toLowerCase().includes(serviceSearch_))

  async function handleLogin(e) {
    e.preventDefault()
    setAuthLoading(true)
    try {
      await api.post('/auth/login', loginData)
      const { data: perfil } = await api.get('/users/perfil/me')
      login({ id: perfil.UUID, publicId: perfil.UUID, email: perfil.Email, name: perfil.Name, role: perfil.Role })
      setStep(4)
    } catch (err) {
      addToast(err.response?.data?.error || 'Erro ao fazer login', 'error')
    } finally {
      setAuthLoading(false)
    }
  }

  async function handleRegister(e) {
    e.preventDefault()
    setAuthLoading(true)
    try {
      const next = `/agendar?sid=${selectedServiceId}&prof_id=${selectedProf.professional_id}&prof_name=${encodeURIComponent(selectedProf.name)}&day=${selectedDay}&month=${calMonth}&year=${calYear}&start=${encodeURIComponent(selectedSlot.start_time)}&end=${encodeURIComponent(selectedSlot.end_time)}`
      await api.post('/auth/register', { ...registerData, next })
      setRegistered(true)
    } catch (err) {
      addToast(err.response?.data?.error || 'Erro ao criar conta', 'error')
    } finally {
      setAuthLoading(false)
    }
  }

  async function handleConfirm(skipConflictCheck = false) {
    if (!user) return
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`

    let clientId = user.publicId
    if (!clientId) {
      try {
        const { data: perfil } = await api.get('/users/perfil/me')
        login({ ...user, publicId: perfil.UUID, role: perfil.Role })
        clientId = perfil.UUID
      } catch {
        return addToast('Erro ao confirmar agendamento', 'error')
      }
    }

    if (!skipConflictCheck) {
      try {
        const { data } = await api.get(`/appointment/client/${clientId}`, { params: { date: dateStr, limit: 50 } })
        const overlapping = (data.data ?? []).find((a) =>
          a.Status !== 'cancelado' &&
          a.Professional_id !== selectedProf.professional_id &&
          (a.Start_time ?? '').slice(0, 5) < selectedSlot.end_time &&
          (a.End_time ?? '').slice(0, 5) > selectedSlot.start_time
        )
        if (overlapping) {
          setSameDayConflict(overlapping)
          return
        }
      } catch {
        // se a checagem falhar, não bloqueia o agendamento — segue direto para a confirmação
      }
    }

    setConfirming(true)
    try {
      await api.post('/appointment', {
        Client: clientId,
        Professional: selectedProf.professional_id,
        Service: selectedServiceId,
        Date: dateStr,
        Start_time: selectedSlot.start_time,
        End_time: selectedSlot.end_time,
      })
      setConfirmed(true)
      setSameDayConflict(null)
    } catch (err) {
      addToast(err.response?.data?.error || 'Erro ao confirmar agendamento', 'error')
    } finally {
      setConfirming(false)
    }
  }

  const dateLabel = selectedDay
    ? `${String(selectedDay).padStart(2, '0')}/${String(calMonth + 1).padStart(2, '0')}/${calYear}`
    : '—'

  return (
    <div className="min-h-screen bg-bg text-ink">
      <Modal
        isOpen={!!sameDayConflict}
        onClose={() => setSameDayConflict(null)}
        onConfirm={() => handleConfirm(true)}
        title="Você já tem um agendamento nesse horário"
        message={sameDayConflict ? `Você já tem um agendamento às ${(sameDayConflict.Start_time ?? '').slice(0, 5)} com ${sameDayConflict.Professional ?? 'outro profissional'} nesse mesmo dia. Deseja continuar mesmo assim?` : ''}
        confirmLabel="Continuar mesmo assim"
        loading={confirming}
      />

      {/* Top bar */}
      <div className="flex justify-between items-center px-4 md:px-10 py-4 md:py-[22px] border-b border-line bg-surface sticky top-0 z-10">
        <div className="flex items-center gap-2.5">
          <img src={logo} alt="Dauth" className="w-11 h-11 rounded-lg object-cover shrink-0" />
          <div className="font-display font-semibold text-[15px] md:text-[17px]">Dauth Agendamentos</div>
        </div>
        {isAuthenticated ? (
          <div className="font-mono text-[11px] md:text-[12px] text-ink-3 truncate max-w-[140px] md:max-w-none">{user?.name}</div>
        ) : (
          <Link to="/login">
            <Button variant="ghost" size="sm">Entrar</Button>
          </Link>
        )}
      </div>

      {/* Barra sticky mobile — aparece quando há seleção */}
      {!(step === 4 && confirmed) && (
        <div
          className={`fixed bottom-0 left-0 right-0 z-30 md:hidden transition-transform duration-300
            ${canContinue ? 'translate-y-0' : 'translate-y-full'}`}
        >
          <div className="bg-surface border-t border-line px-4 py-3 flex items-center gap-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
            {step > 0 && (
              <button
                onClick={back}
                className="p-2.5 rounded-lg border border-line text-ink-2 hover:bg-surface-2 transition-colors shrink-0"
              >
                <Icon name="arrowLeft" size={16} />
              </button>
            )}
            <div className="flex-1 min-w-0">
              {step === 0 && svc && (
                <>
                  <div className="text-[11px] text-ink-3 font-mono uppercase tracking-widest">Serviço selecionado</div>
                  <div className="text-[14px] font-medium truncate">{svc.Name}</div>
                </>
              )}
              {step === 1 && selectedProf && (
                <>
                  <div className="text-[11px] text-ink-3 font-mono uppercase tracking-widest">Profissional</div>
                  <div className="text-[14px] font-medium truncate">{selectedProf.name}</div>
                </>
              )}
              {step === 2 && selectedDay && selectedSlot && (
                <>
                  <div className="text-[11px] text-ink-3 font-mono uppercase tracking-widest">Data e horário</div>
                  <div className="text-[14px] font-medium">{dateLabel} · {selectedSlot.start_time}</div>
                </>
              )}
              {step === 3 && isAuthenticated && (
                <>
                  <div className="text-[11px] text-ink-3 font-mono uppercase tracking-widest">Conta</div>
                  <div className="text-[14px] font-medium truncate">{user?.name}</div>
                </>
              )}
              {step === 4 && !confirmed && (
                <>
                  <div className="text-[11px] text-ink-3 font-mono uppercase tracking-widest">Pronto para confirmar</div>
                  <div className="text-[14px] font-medium">{svc?.Name} · {dateLabel}</div>
                </>
              )}
            </div>
            {step < 4 ? (
              <button
                onClick={next}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand text-white font-medium text-[14px] shrink-0 active:bg-[#72391f] transition-colors"
              >
                Continuar <Icon name="arrowRight" size={14} />
              </button>
            ) : (
              <button
                onClick={() => handleConfirm()}
                disabled={confirming}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand text-white font-medium text-[14px] shrink-0 active:bg-[#72391f] transition-colors disabled:opacity-60"
              >
                <Icon name="check" size={14} />{confirming ? 'Confirmando...' : 'Confirmar'}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="max-w-[1120px] mx-auto px-4 md:px-10 pt-6 md:pt-10 pb-28 md:pb-16">

        {/* Stepper */}
        <div className="flex gap-1 md:gap-2 mb-7 md:mb-9 p-2 md:p-3 bg-surface border border-line rounded-lg overflow-x-auto">
          {STEPS.map((label, i) => (
            <div
              key={label}
              className={`flex items-center gap-2 md:gap-2.5 px-2.5 md:px-3.5 py-2 md:py-2.5 rounded-[10px] text-[12px] md:text-[13px] flex-shrink-0
                ${i === step ? 'bg-ink text-bg' : i < step ? 'text-ink-2' : 'text-ink-3'}`}
            >
              <span
                className={`w-5 h-5 md:w-6 md:h-6 rounded-full inline-flex items-center justify-center font-mono text-[10px] md:text-[11.5px] font-semibold border flex-shrink-0
                  ${i === step ? 'bg-gold text-ink border-transparent'
                    : i < step ? 'bg-success-soft text-success border-transparent'
                      : 'bg-surface-2 text-ink-3 border-line'}`}
              >
                {i < step ? <Icon name="check" size={10} /> : i + 1}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </div>
          ))}
        </div>

        {/* ── PASSO 0 — Serviço ───────────────────────────────────────── */}
        {step === 0 && (
          <>
            <h2 className="font-display font-medium text-[26px] md:text-[32px] tracking-tight mb-2">Qual serviço hoje?</h2>
            <p className="text-ink-2 text-[14px] md:text-[14.5px] mb-6 md:mb-8 max-w-[560px]">
              Filtre pela categoria ou escolha entre os serviços disponíveis.
            </p>
            <div className="relative mb-4 max-w-[360px]">
              <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4" />
              <input
                type="text"
                value={serviceSearch}
                onChange={(e) => setServiceSearch(e.target.value)}
                placeholder="Buscar serviço..."
                className="w-full h-[38px] pl-8 pr-3 rounded-full border border-line bg-surface text-ink-2 text-[13px] placeholder:text-ink-4 focus:outline-none focus:border-brand transition-colors"
              />
            </div>
            <div className="flex gap-2 mb-5 flex-wrap">
              {categories.map((cat) => (
                <button key={cat} onClick={() => setActiveCategory(cat)}
                  className={`px-3 md:px-3.5 py-1.5 md:py-2 rounded-full text-[12px] md:text-[13px] font-medium border cursor-pointer transition-colors
                    ${cat === activeCategory ? 'bg-ink text-bg border-ink' : 'bg-surface-2 text-ink-2 border-line hover:border-ink-3'}`}>
                  {cat}
                </button>
              ))}
            </div>
            {loadingServices ? (
              <div className="flex items-center justify-center h-48 text-ink-3 text-[13px]">Carregando serviços...</div>
            ) : filteredServices.length === 0 ? (
              <div className="flex items-center justify-center h-48 bg-surface border border-line border-dashed rounded-[14px] text-ink-3 text-[13px]">
                Nenhum serviço encontrado
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-3.5">
                {filteredServices.map((s) => (
                  <button key={s.UUID} onClick={() => setSelectedServiceId(s.UUID)}
                    className={`bg-surface border rounded-[14px] p-5 md:p-[22px] text-left cursor-pointer transition-all
                      ${selectedServiceId === s.UUID ? 'border-brand shadow-[0_0_0_3px_#f1e3d6]' : 'border-line hover:border-ink-3 hover:-translate-y-0.5'}`}>
                    <div className="font-mono text-[10px] md:text-[10.5px] uppercase tracking-widest text-brand mb-2">{s.Category}</div>
                    <div className="font-display font-medium text-[17px] md:text-[19px] tracking-tight mb-1">{s.Name}</div>
                    <div className="flex justify-between items-center pt-3 md:pt-3.5 border-t border-line-2 mt-3 md:mt-4">
                      <div className="font-mono text-[11px] md:text-[12px] text-ink-3 flex items-center gap-1">
                        <Icon name="clock" size={12} />{formatDuration(s.Duration)}
                      </div>
                      <div className="font-display text-[14px] md:text-[15px] font-medium">{formatFromPrice(s.Min_price ?? s.Price)}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── PASSO 1 — Profissional ──────────────────────────────────── */}
        {step === 1 && (
          <>
            <h2 className="font-display font-medium text-[26px] md:text-[32px] tracking-tight mb-2">Escolha o profissional</h2>
            <p className="text-ink-2 text-[14px] md:text-[14.5px] mb-6 md:mb-8 max-w-[560px]">
              Todos os profissionais abaixo realizam <strong>{svc?.Name}</strong>.
            </p>
            {loadingProfs ? (
              <div className="flex items-center justify-center h-48 text-ink-3 text-[13px]">Carregando profissionais...</div>
            ) : professionals.length === 0 ? (
              <div className="flex items-center justify-center h-48 bg-surface border border-line border-dashed rounded-[14px] text-ink-3 text-[13px]">
                Nenhum profissional disponível para este serviço
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {professionals.map((p, idx) => (
                  <button key={p.professional_id} onClick={() => setSelectedProf(p)}
                    className={`bg-surface border rounded-[14px] p-4 md:p-5 flex gap-4 items-center cursor-pointer text-left transition-all
                      ${selectedProf?.professional_id === p.professional_id ? 'border-brand shadow-[0_0_0_3px_#f1e3d6]' : 'border-line hover:border-ink-3'}`}>
                    <Avatar name={p.name} index={idx} size="lg" />
                    <div className="flex-1 min-w-0">
                      <div className="font-display font-medium text-[16px] md:text-[17px]">{p.name}</div>
                      <div className="font-mono text-[12px] text-ink-3 mt-0.5">{formatPrice(p.price)}</div>
                    </div>
                    {selectedProf?.professional_id === p.professional_id && (
                      <div className="w-6 h-6 rounded-full bg-brand flex items-center justify-center flex-shrink-0">
                        <Icon name="check" size={12} className="text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── PASSO 2 — Data e hora ───────────────────────────────────── */}
        {step === 2 && (
          <>
            <h2 className="font-display font-medium text-[26px] md:text-[32px] tracking-tight mb-2">Escolha a data e horário</h2>
            <p className="text-ink-2 text-[14px] md:text-[14.5px] mb-6 md:mb-8 max-w-[560px]">
              Disponibilidade de <strong>{selectedProf?.name}</strong> para <strong>{svc?.Name}</strong>.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-7">
              {/* Calendário */}
              <div className="bg-surface border border-line rounded-[14px] p-4 md:p-5">
                <div className="flex justify-between items-center mb-3.5">
                  <div className="font-display font-medium text-[15px] md:text-[16px]">{MONTH_NAMES[calMonth]} {calYear}</div>
                  <div className="flex gap-1">
                    <button onClick={prevMonth} className="w-[30px] h-[30px] rounded-lg border border-line bg-surface text-ink-2 flex items-center justify-center hover:border-ink-3 transition-colors">
                      <Icon name="arrowLeft" size={13} />
                    </button>
                    <button onClick={nextMonth} className="w-[30px] h-[30px] rounded-lg border border-line bg-surface text-ink-2 flex items-center justify-center hover:border-ink-3 transition-colors">
                      <Icon name="arrowRight" size={13} />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-7 mb-1.5 gap-0.5">
                  {DOWS.map((d, i) => (
                    <div key={i} className="font-mono text-[10.5px] text-ink-3 text-center">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {calDays.map((d, i) => {
                    const past = d ? isDayPast(d) : false
                    return (
                      <button
                        key={i}
                        disabled={!d || past}
                        onClick={() => d && !past && setSelectedDay(d)}
                        className={`aspect-square flex items-center justify-center text-[12px] md:text-[13px] rounded-lg transition-colors
                          ${!d ? '' : selectedDay === d ? 'bg-ink text-bg font-semibold'
                            : past ? 'text-ink-4 cursor-not-allowed'
                              : 'text-ink hover:bg-surface-2 cursor-pointer'}`}
                      >
                        {d}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Slots */}
              <div>
                <div className="font-mono text-[11px] uppercase tracking-widest text-ink-3 mb-3">
                  {selectedDay
                    ? `Horários disponíveis · ${String(selectedDay).padStart(2, '0')}/${String(calMonth + 1).padStart(2, '0')}`
                    : 'Selecione uma data'}
                </div>
                {!selectedDay ? (
                  <div className="flex items-center justify-center h-40 md:h-48 bg-surface border border-line border-dashed rounded-[14px] text-ink-3 text-[13px]">
                    Escolha um dia no calendário
                  </div>
                ) : loadingSlots ? (
                  <div className="flex items-center justify-center h-40 md:h-48 text-ink-3 text-[13px]">Buscando horários...</div>
                ) : slots.length === 0 ? (
                  <div className="flex items-center justify-center h-40 md:h-48 bg-surface border border-line border-dashed rounded-[14px] text-ink-3 text-[13px] text-center px-6">
                    {slotsMessage || 'Nenhum horário disponível nesta data'}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {slots.map((slot) => (
                      <button
                        key={slot.start_time}
                        onClick={() => setSelectedSlot(slot)}
                        className={`py-2.5 md:py-3 text-center rounded-[10px] border font-mono text-[12px] md:text-[13px] transition-colors
                          ${selectedSlot?.start_time === slot.start_time
                            ? 'bg-ink text-bg border-ink'
                            : 'bg-surface border-line hover:border-ink-3 cursor-pointer'}`}
                      >
                        {slot.start_time}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── PASSO 3 — Auth ──────────────────────────────────────────── */}
        {step === 3 && !isAuthenticated && (
          <>
            {registered ? (
              <div className="max-w-[480px]">
                <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mb-5">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4a6b3e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.42 2 2 0 0 1 3.6 1.25h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.69 2.81a2 2 0 0 1-.45 2.11L7.91 8.82a16 16 0 0 0 6.27 6.27l.97-.97a2 2 0 0 1 2.11-.45c.91.33 1.85.56 2.81.69A2 2 0 0 1 22 16.92z" />
                  </svg>
                </div>
                <h2 className="font-display font-medium text-[26px] md:text-[32px] tracking-tight mb-2">Verifique seu WhatsApp</h2>
                <p className="text-ink-2 text-[14px] md:text-[14.5px] mb-6 max-w-[420px]">
                  Enviamos um link de verificação para <span className="font-medium text-ink">{registerData.phone}</span>. Clique no link para ativar sua conta e volte aqui para concluir o agendamento.
                </p>
                <Button variant="primary" onClick={() => navigate('/login')}>
                  Ir para o login
                </Button>
              </div>
            ) : (
              <>
            <h2 className="font-display font-medium text-[26px] md:text-[32px] tracking-tight mb-2">Seus dados</h2>
            <p className="text-ink-2 text-[14px] md:text-[14.5px] mb-6 md:mb-8 max-w-[560px]">
              Entre na sua conta ou crie uma nova para finalizar o agendamento.
            </p>

            {/* Mobile: tabs */}
            <div className="flex gap-1 mb-5 border-b border-line md:hidden">
              {['login', 'register'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setAuthMode(mode)}
                  className={`px-4 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors
                    ${authMode === mode ? 'border-brand text-ink' : 'border-transparent text-ink-3'}`}
                >
                  {mode === 'login' ? 'Já tenho conta' : 'Criar conta'}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {/* Login */}
              <div
                className={`bg-surface border rounded-[14px] p-5 md:p-8 cursor-pointer transition-colors
                  ${authMode === 'login' ? 'border-brand shadow-[0_0_0_3px_#f1e3d6]' : 'border-line hover:border-ink-3'}
                  ${authMode !== 'login' ? 'hidden md:block' : ''}`}
                onClick={() => setAuthMode('login')}
              >
                <h3 className="font-display font-medium text-[18px] md:text-[20px] tracking-tight mb-4 md:mb-5">Já tenho conta</h3>
                <form onSubmit={handleLogin} onClick={(e) => e.stopPropagation()}>
                  <AuthField label="Telefone" type="tel" placeholder="(11) 9 8765-4321"
                    value={loginData.phone} onChange={(v) => setLoginData((d) => ({ ...d, phone: v }))} />
                  <AuthField label="Senha" type="password" placeholder="Sua senha"
                    value={loginData.password} onChange={(v) => setLoginData((d) => ({ ...d, password: v }))} />
                  <Button type="submit" variant="primary" className="w-full justify-center mt-2"
                    disabled={authLoading}>
                    {authLoading && authMode === 'login' ? 'Entrando...' : 'Entrar'}
                  </Button>
                </form>
              </div>

              {/* Register */}
              <div
                className={`bg-surface border rounded-[14px] p-5 md:p-8 cursor-pointer transition-colors
                  ${authMode === 'register' ? 'border-brand shadow-[0_0_0_3px_#f1e3d6]' : 'border-line hover:border-ink-3'}
                  ${authMode !== 'register' ? 'hidden md:block' : ''}`}
                onClick={() => setAuthMode('register')}
              >
                <h3 className="font-display font-medium text-[18px] md:text-[20px] tracking-tight mb-4 md:mb-5">Criar conta</h3>
                <form onSubmit={handleRegister} onClick={(e) => e.stopPropagation()}>
                  <AuthField label="Nome completo" type="text" placeholder="Seu nome"
                    value={registerData.name} onChange={(v) => setRegisterData((d) => ({ ...d, name: v }))} />
                  <AuthField label="Telefone" type="tel" placeholder="(11) 9 8765-4321"
                    value={registerData.phone} onChange={(v) => setRegisterData((d) => ({ ...d, phone: v }))} />
                  <AuthField label="Data de nascimento" type="date"
                    value={registerData.birthday} onChange={(v) => setRegisterData((d) => ({ ...d, birthday: v }))} />
                  <AuthField label="Senha" type="password" placeholder="Mínimo 8 caracteres"
                    value={registerData.password} onChange={(v) => setRegisterData((d) => ({ ...d, password: v }))} />
                  <Button type="submit" variant="primary" className="w-full justify-center mt-2"
                    disabled={authLoading}>
                    {authLoading && authMode === 'register' ? 'Criando conta...' : 'Criar conta'}
                  </Button>
                </form>
              </div>
            </div>
              </>
            )}
          </>
        )}

        {/* ── PASSO 4 — Confirmar ─────────────────────────────────────── */}
        {step === 4 && !confirmed && (
          <>
            <h2 className="font-display font-medium text-[26px] md:text-[32px] tracking-tight mb-2">Confirmar agendamento</h2>
            <p className="text-ink-2 text-[14px] md:text-[14.5px] mb-6 md:mb-8 max-w-[560px]">
              Revise os detalhes antes de confirmar.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-[1.3fr_1fr] gap-4 md:gap-5">
              <div className="bg-surface border-2 border-ink rounded-2xl p-5 md:p-7">
                {[
                  { k: 'Serviço', v: svc?.Name ?? '—' },
                  { k: 'Duração', v: svc ? formatDuration(svc.Duration) : '—' },
                  { k: 'Profissional', v: selectedProf?.name ?? '—' },
                  { k: 'Data', v: dateLabel },
                  { k: 'Horário', v: selectedSlot?.start_time ?? '—' },
                  { k: 'Total', v: svc ? formatPrice(selectedProf?.price ?? svc.Price) : '—', total: true },
                ].map(({ k, v, total }) => (
                  <div
                    key={k}
                    className={`flex justify-between items-center py-3 md:py-3.5 border-b border-dashed border-line-2 last:border-0 ${total ? 'pt-3 md:pt-4' : ''}`}
                  >
                    <span className="font-mono text-[10px] md:text-[11px] uppercase tracking-widest text-ink-3">{k}</span>
                    <span className={total ? 'font-display text-[20px] md:text-[22px] font-medium' : 'text-[13px] md:text-[14px] font-medium'}>{v}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-3 md:gap-4">
                <div className="bg-surface border border-line rounded-2xl p-5 md:p-6">
                  <div className="font-mono text-[10.5px] uppercase tracking-widest text-ink-3 mb-3">Profissional</div>
                  <div className="flex items-center gap-3">
                    <Avatar name={selectedProf?.name ?? ''} index={0} size="lg" />
                    <div className="font-display font-medium text-[15px] md:text-[16px]">{selectedProf?.name}</div>
                  </div>
                </div>
                {user && (
                  <div className="bg-surface border border-line rounded-xl p-4 text-[13px] text-ink-2">
                    <div className="font-mono text-[10.5px] uppercase tracking-widest text-ink-3 mb-1">Conta</div>
                    {user.name}
                  </div>
                )}
                <div className="bg-surface-2 border border-line-2 rounded-xl p-4 text-[12px] md:text-[13px] text-ink-2">
                  <Icon name="clock" size={14} className="inline mr-1.5 text-ink-3" />
                  Pagamento no local. Cancelamentos com menos de 3h de antecedência podem gerar cobrança do serviço.
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── SUCESSO ─────────────────────────────────────────────────── */}
        {step === 4 && confirmed && (
          <div
            className="border border-line rounded-2xl px-5 md:px-8 py-10 md:py-12 text-center"
            style={{ background: 'linear-gradient(180deg, #e3ebd9 0%, #ffffff 100%)' }}
          >
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-success text-white inline-flex items-center justify-center mb-5">
              <Icon name="check" size={26} />
            </div>
            <h2 className="font-display font-medium text-[24px] md:text-[28px] tracking-tight mb-2.5">
              Agendamento confirmado!
            </h2>
            <div className="font-mono text-[13px] md:text-[14px] text-ink-2 mb-1">
              {svc?.Name} · {dateLabel} · {selectedSlot?.start_time}
            </div>
            <div className="font-mono text-[12px] md:text-[13px] text-ink-3 mb-8">
              com {selectedProf?.name}
            </div>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <Button variant="primary" onClick={() => {
                const area = user?.role === 'Admin' ? 'admin' : user?.role === 'Profissional' ? 'profissional' : 'cliente'
                navigate(salonSlug ? `/${salonSlug}/${area}` : '/marketplace')
              }}>Ver meus agendamentos</Button>
              <Button variant="ghost" onClick={() => navigate('/marketplace')}>Voltar ao marketplace</Button>
            </div>
          </div>
        )}

        {/* Navegação — visível só no desktop, mobile usa a barra sticky */}
        {!(step === 4 && confirmed) && (
          <div className="hidden md:flex justify-between items-center mt-8">
            {step > 0 ? (
              <Button variant="ghost" onClick={back}>
                <Icon name="arrowLeft" size={14} />Voltar
              </Button>
            ) : <div />}
            {step < 4 ? (
              <Button variant="primary" onClick={next} disabled={!canContinue}>
                Continuar <Icon name="arrowRight" size={14} />
              </Button>
            ) : (
              <Button variant="primary" onClick={() => handleConfirm()} disabled={confirming}>
                <Icon name="check" size={14} />{confirming ? 'Confirmando...' : 'Confirmar agendamento'}
              </Button>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

function maskPhone(v) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`
}

function AuthField({ label, type, placeholder, value, onChange }) {
  function handleChange(e) {
    const raw = e.target.value
    onChange(type === 'tel' ? maskPhone(raw) : raw)
  }
  return (
    <div className="flex flex-col gap-1.5 mb-4">
      <label className="text-[11px] text-ink-3 font-medium uppercase tracking-wider">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        className="h-[42px] px-[14px] rounded-md border border-line bg-surface text-ink-2 font-body text-md
          placeholder:text-ink-4 focus:outline-none focus:border-brand transition-colors"
      />
    </div>
  )
}
