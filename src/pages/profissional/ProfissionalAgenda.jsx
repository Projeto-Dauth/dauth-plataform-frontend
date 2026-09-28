import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AppLayout from '@/components/layout/AppLayout'
import Sidebar from '@/components/layout/Sidebar'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/Icons'
import { PageSpinner } from '@/components/ui/Spinner'
import SearchableSelect from '@/components/ui/SearchableSelect'
import AssistantField, { assistantPayload } from '@/components/ui/AssistantField'
import { useToast } from '@/context/ToastContext'
import useAuthStore from '@/store/authStore'
import api from '@/lib/api'
import { searchClients } from '@/lib/searchClients'
import { batchPayExtraMessage } from '@/lib/creditToast'
import { navItemsByRole } from '@/config/navItems'
import { excludeMonitorAdmins } from '@/config/monitorAdmins'
import { useTour } from '@/hooks/useTour'
import { profissionalSteps } from '@/tours/profissionalTour'
import Modal from '@/components/ui/Modal'
import ModalFecharConta from '@/components/ui/ModalFecharConta'
import { usePermission } from '@/hooks/usePermission'
import { outsideWorkingHours, workingHoursLabel, fetchWorkingHours, buildOutsideHoursWarning, UNKNOWN_HOURS } from '@/lib/workingHours'

const navItems = navItemsByRole['Profissional']

const TIME_SLOTS = []
for (let h = 6; h < 24; h++) {
  TIME_SLOTS.push(`${String(h).padStart(2, '0')}:00`)
  TIME_SLOTS.push(`${String(h).padStart(2, '0')}:30`)
}

const WEEK_DAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

const STATUS_STYLE = {
  pendente:  { card: 'bg-[#dbeafe] border-[#93c5fd] text-[#1d4ed8]', dot: 'bg-[#3b82f6]' },
  confirmado:{ card: 'bg-success-soft border-success/40 text-success', dot: 'bg-success' },
  concluido: { card: 'bg-[#faecd6] border-gold/50 text-[#7a5c2e]', dot: 'bg-gold' },
  cancelado: { card: 'bg-danger-soft border-danger/40 text-danger line-through opacity-60', dot: 'bg-danger' },
}

function parseTime(t) { return t.slice(0, 5) }

function serviceLabel(appt) {
  return appt.Services?.length > 0 ? appt.Services.map(s => s.Name).join(' + ') : appt.Service
}

function serviceNames(appt) {
  return appt.Services?.length > 0 ? appt.Services.map(s => s.Name) : [appt.Service]
}

function toMinutes(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

// Um Appointment pode ter um "buraco" no meio de Services[] (ex: o serviço do meio foi
// reatribuído a outra profissional na edição — sai do bloco via Remove_services, mas
// Appointment.Start_time/End_time continuam sendo o menor início e o maior fim dos itens
// que sobraram, então ainda cobrem o horário do item removido). Sem isso, o bloco desenha
// um retângulo único e contínuo mostrando tempo ocioso que na verdade é de outra
// profissional. splitIntoSegments quebra o appt em N blocos visuais contíguos a partir dos
// horários reais de Services[]; sem buraco (ou sem Services[], formato singular antigo)
// continua virando 1 segmento só, idêntico ao comportamento anterior.
function splitIntoSegments(appt) {
  if (!appt.Services?.length) return [appt]
  const sorted = [...appt.Services].sort((a, b) =>
    toMinutes(parseTime(a.Start_time ?? appt.Start_time)) - toMinutes(parseTime(b.Start_time ?? appt.Start_time))
  )
  const groups = []
  for (const s of sorted) {
    const start = s.Start_time ?? appt.Start_time
    const end = s.End_time ?? appt.End_time
    const last = groups[groups.length - 1]
    if (last && toMinutes(parseTime(start)) <= toMinutes(parseTime(last.End_time))) {
      last.Services.push(s)
      if (toMinutes(parseTime(end)) > toMinutes(parseTime(last.End_time))) last.End_time = end
    } else {
      groups.push({ Start_time: start, End_time: end, Services: [s] })
    }
  }
  if (groups.length <= 1) return [appt]
  // _original preserva o Appointment inteiro (Start_time/End_time/Services completos) —
  // ações que operam sobre o registro real (editar, excluir, mudar status, fechar comanda)
  // devem usar isso, não os campos truncados do segmento visual.
  return groups.map((g, i) => ({
    ...appt,
    Start_time: g.Start_time,
    End_time: g.End_time,
    Services: g.Services,
    _segKey: `${appt.UUID}::${i}`,
    _original: appt,
  }))
}

function coversSlot(appt, slot) {
  const start = toMinutes(parseTime(appt.Start_time))
  const end   = toMinutes(parseTime(appt.End_time))
  const s = toMinutes(slot)
  return s >= start && s < end
}

function anchoredToSlot(appt, slot) {
  const startMin = toMinutes(parseTime(appt.Start_time))
  const slotMin  = toMinutes(slot)
  return startMin >= slotMin && startMin < slotMin + 30
}

function spanSlots(appt) {
  const start = toMinutes(parseTime(appt.Start_time))
  const end   = toMinutes(parseTime(appt.End_time))
  return Math.max(1, Math.ceil((end - start) / 30))
}

function apptHeight(appt, cellH) {
  const startMin = toMinutes(parseTime(appt.Start_time))
  const endMin   = toMinutes(parseTime(appt.End_time))
  return Math.max(cellH / 2 - 4, ((endMin - startMin) / 30) * cellH - 4)
}

function apptTop(appt, slot, cellH) {
  const startMin = toMinutes(parseTime(appt.Start_time))
  const slotMin  = toMinutes(slot)
  return ((startMin - slotMin) / 30) * cellH + 2
}

function isSlotPast(date, slot) {
  const now   = new Date()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (date < today) return true
  if (date > today) return false
  const [h, m] = slot.split(':').map(Number)
  return now.getHours() * 60 + now.getMinutes() > h * 60 + m
}

function toDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatHeader(date) {
  const dow = WEEK_DAYS[date.getDay()]
  const d   = date.getDate()
  const mon = MONTHS[date.getMonth()]
  const year = date.getFullYear()
  return `${dow.charAt(0).toUpperCase() + dow.slice(1)}, ${d} de ${mon} de ${year}`
}

function addMinutes(timeStr, mins) {
  const [h, m] = timeStr.split(':').map(Number)
  const total  = h * 60 + m + mins
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function isBreakStart(wh, slot) {
  return wh?.Break_start && wh.Break_start.slice(0, 5) === slot
}

function coversBreak(wh, slot) {
  if (!wh?.Break_start || !wh?.Break_end) return false
  const s = toMinutes(slot)
  return s >= toMinutes(wh.Break_start.slice(0, 5)) && s < toMinutes(wh.Break_end.slice(0, 5))
}

function spanBreak(wh) {
  if (!wh?.Break_start || !wh?.Break_end) return 0
  return Math.max(1, Math.ceil((toMinutes(wh.Break_end.slice(0, 5)) - toMinutes(wh.Break_start.slice(0, 5))) / 30))
}

function leaveCoversSlot(leaves, slot) {
  if (!leaves?.length) return false
  return leaves.some(l => {
    if (l.All_day) return true
    if (!l.Start_time || !l.End_time) return false
    const s = toMinutes(slot)
    return s >= toMinutes(l.Start_time.slice(0, 5)) && s < toMinutes(l.End_time.slice(0, 5))
  })
}
function leaveStartsAt(leaves, slot) {
  if (!leaves?.length) return null
  if (leaves.some(l => l.All_day) && slot === TIME_SLOTS[0]) return leaves.find(l => l.All_day)
  const slotMin = toMinutes(slot)
  return leaves.find(l => {
    if (l.All_day || !l.Start_time) return false
    const startMin = toMinutes(l.Start_time.slice(0, 5))
    return startMin >= slotMin && startMin < slotMin + 30
  }) ?? null
}
function leaveTop(leave, slot, cellH) {
  if (leave.All_day || !leave.Start_time) return 2
  const startMin = toMinutes(leave.Start_time.slice(0, 5))
  const slotMin = toMinutes(slot)
  return ((startMin - slotMin) / 30) * cellH + 2
}
function leaveHeight(leave, cellH) {
  if (leave.All_day) return TIME_SLOTS.length * cellH - 4
  if (!leave.Start_time || !leave.End_time) return cellH - 4
  const startMin = toMinutes(leave.Start_time.slice(0, 5))
  const endMin = toMinutes(leave.End_time.slice(0, 5))
  return Math.max(cellH / 2 - 4, ((endMin - startMin) / 30) * cellH - 4)
}

function computeColumns(appts) {
  const sorted  = [...appts].sort((a, b) => toMinutes(parseTime(a.Start_time)) - toMinutes(parseTime(b.Start_time)))
  const colEnds = []
  const colMap  = new Map()
  sorted.forEach(appt => {
    const key = appt._segKey ?? appt.UUID
    const start = toMinutes(parseTime(appt.Start_time))
    const end   = toMinutes(parseTime(appt.End_time))
    let col = colEnds.findIndex(e => e <= start)
    if (col === -1) { col = colEnds.length; colEnds.push(end) } else colEnds[col] = end
    colMap.set(key, { col, start, end })
  })
  const result = new Map()
  colMap.forEach((data, uuid) => {
    let maxCol = data.col
    colMap.forEach((other, otherUuid) => {
      if (uuid !== otherUuid && other.start < data.end && other.end > data.start) {
        maxCol = Math.max(maxCol, other.col)
      }
    })
    result.set(uuid, { col: data.col, totalCols: maxCol + 1 })
  })
  return result
}

const INPUT_CLS = 'w-full h-[42px] px-[14px] rounded-md border border-line bg-surface text-ink-2 font-body text-md placeholder:text-ink-4 focus:outline-none focus:border-brand transition-colors'
const MODAL_CLS = 'fixed inset-0 z-50 flex items-center justify-center p-4'
const MODAL_INNER_CLS = 'w-full max-w-[380px] bg-bg border border-line rounded-2xl shadow-xl flex flex-col'

function applyPhoneMask(v) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return `(${d}`
  if (d.length <= 7) return `(${d.slice(0,2)}) ${d.slice(2)}`
  if (d.length <= 11) return `(${d.slice(0,2)}) ${d.slice(2,3)} ${d.slice(3,7)}-${d.slice(7)}`
  return v
}

function ModalNovaCategoria({ onClose, onCreated }) {
  const { addToast } = useToast()
  const [nome, setNome] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    if (!nome.trim()) return
    setSaving(true)
    try {
      const { data } = await api.post('/category', { Name: nome.trim() })
      addToast('Categoria criada', 'success')
      onCreated(data.data ?? data)
      onClose()
    } catch (err) {
      addToast(err.response?.data?.error ?? 'Erro ao criar categoria', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`relative ${MODAL_INNER_CLS}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h4 className="font-display font-medium text-[15px] tracking-tight">Nova categoria</h4>
          <button onClick={onClose} className="text-ink-3 hover:text-ink transition-colors cursor-pointer"><Icon name="x" size={16} /></button>
        </div>
        <form onSubmit={handleSave} className="px-5 py-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-ink-2">Nome da categoria</label>
            <input
              required
              autoFocus
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: Cabelo"
              className={INPUT_CLS}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="ghost" className="flex-1 justify-center" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="flex-1 justify-center" loading={saving}>Criar</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ModalNovoCliente({ onClose, onCreated }) {
  const { addToast } = useToast()
  const [form, setForm] = useState({ name: '', phone: '', birthday: '' })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  function validate() {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Nome é obrigatório'
    if (!/^\(\d{2}\) \d \d{4}-\d{4}$/.test(form.phone)) errs.phone = 'Ex: (11) 9 9999-9999'
    return errs
  }

  async function handleSave(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setSaving(true)
    try {
      const body = { name: form.name.trim(), phone: form.phone }
      if (form.birthday) body.birthday = form.birthday
      await api.post('/auth/register-admin', body)
      addToast(`${form.name} cadastrado com sucesso`, 'success')
      const { data: usersRes } = await api.get('/users', { params: { Role: 'Usuario', search: form.phone, limit: 5 } })
      const criado = (usersRes.data ?? []).find(u => u.Phone === form.phone)
      onCreated(criado ?? { Name: form.name.trim(), Phone: form.phone })
      onClose()
    } catch (err) {
      const msg = err.response?.data?.error
      if (msg?.includes('Telefone') || msg?.includes('telefone')) {
        setErrors({ phone: 'Telefone já cadastrado' })
      } else {
        addToast(msg ?? 'Erro ao cadastrar cliente', 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={MODAL_CLS}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`relative ${MODAL_INNER_CLS}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h4 className="font-display font-medium text-[15px] tracking-tight">Novo cliente</h4>
          <button onClick={onClose} className="text-ink-3 hover:text-ink transition-colors cursor-pointer"><Icon name="x" size={16} /></button>
        </div>
        <form onSubmit={handleSave} className="px-5 py-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-ink-2">Nome</label>
            <input
              required
              autoFocus
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Nome completo"
              className={`${INPUT_CLS} ${errors.name ? 'border-danger' : ''}`}
            />
            {errors.name && <span className="text-[11px] text-danger">{errors.name}</span>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-ink-2">Telefone</label>
            <input
              required
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: applyPhoneMask(e.target.value) }))}
              placeholder="(11) 9 9999-9999"
              className={`${INPUT_CLS} ${errors.phone ? 'border-danger' : ''}`}
            />
            {errors.phone && <span className="text-[11px] text-danger">{errors.phone}</span>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-ink-2">Nascimento <span className="text-ink-4 font-normal">(opcional)</span></label>
            <input
              type="date"
              value={form.birthday}
              onChange={e => setForm(f => ({ ...f, birthday: e.target.value }))}
              className={INPUT_CLS}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="ghost" className="flex-1 justify-center" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="flex-1 justify-center" loading={saving}>Criar</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function LeaveContextMenu({ leave, x, y, onClose, onEdit, onRemove }) {
  const menuRef = useRef(null)
  useEffect(() => {
    function handle(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose()
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handle)
    document.addEventListener('keydown', handle)
    return () => { document.removeEventListener('mousedown', handle); document.removeEventListener('keydown', handle) }
  }, [onClose])
  const menuW = 180, menuH = 116
  const adjX = x + menuW > window.innerWidth ? x - menuW : x
  const adjY = y + menuH > window.innerHeight ? y - menuH : y
  return (
    <div ref={menuRef} className="fixed z-50 bg-surface border border-line rounded-xl shadow-lg py-1.5 min-w-[180px]" style={{ left: adjX, top: adjY }}>
      <div className="px-3.5 py-2 border-b border-line mb-1">
        <div className="font-medium text-[12.5px]">Folga</div>
        {leave.Reason && <div className="text-[11px] text-ink-3 truncate">{leave.Reason}</div>}
      </div>
      <button
        onClick={() => { onEdit(leave); onClose() }}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-ink-2 hover:bg-surface-2 transition-colors cursor-pointer"
      >
        <Icon name="edit" size={13} />
        Editar folga
      </button>
      <button
        onClick={() => { onRemove(leave); onClose() }}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-danger hover:bg-surface-2 transition-colors cursor-pointer"
      >
        <Icon name="trash" size={13} />
        Remover folga
      </button>
    </div>
  )
}

function AppointmentContextMenu({ appt, x, y, onClose, onStatusChange, onNavigate, onTransfer, onOpenComanda, onFecharConta, canFecharConta, onDelete }) {
  const menuRef = useRef(null)

  useEffect(() => {
    function handleKey(e)   { if (e.key === 'Escape') onClose() }
    function handleClick(e) { if (menuRef.current && !menuRef.current.contains(e.target)) onClose() }
    document.addEventListener('keydown', handleKey)
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('touchstart', handleClick)
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('touchstart', handleClick)
    }
  }, [onClose])

  const menuW = 200, menuH = 210
  const adjustedX = x + menuW > window.innerWidth  ? x - menuW : x
  const adjustedY = y + menuH > window.innerHeight ? y - menuH : y

  const actions = []
  if (appt.Status === 'pendente')   actions.push({ label: 'Marcar como Confirmado', icon: 'check', status: 'confirmado', color: 'text-success' })
  if (appt.Status === 'confirmado') actions.push({ label: 'Marcar como Concluído',  icon: 'check', status: 'concluido',  color: 'text-ink-2' })
  if (appt.Status === 'concluido') actions.push({ label: 'Voltar para Confirmado', icon: 'arrowLeft', status: 'confirmado', color: 'text-warning' })
  if (appt.Status === 'pendente' || appt.Status === 'confirmado')
    actions.push({ label: 'Marcar como Cancelado', icon: 'x', status: 'cancelado', color: 'text-danger' })

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-surface border border-line rounded-xl shadow-lg py-1.5 min-w-[200px]"
      style={{ left: adjustedX, top: adjustedY }}
    >
      <div className="px-3.5 py-2 border-b border-line mb-1">
        <div className="font-medium text-[12.5px] truncate">{appt.Client}</div>
        <div className="font-mono text-[10.5px] text-ink-3 truncate">{serviceLabel(appt)} · {parseTime(appt.Start_time)}</div>
      </div>
      {actions.map(({ label, icon, status, color }) => (
        <button key={status} onClick={() => { onStatusChange(appt, status); onClose() }}
          className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] hover:bg-surface-2 transition-colors cursor-pointer ${color}`}>
          <Icon name={icon} size={13} />{label}
        </button>
      ))}
      {actions.length > 0 && <div className="border-t border-line my-1" />}
      {(appt.Status === 'pendente' || appt.Status === 'confirmado') && (
        <button onClick={() => { onTransfer(appt); onClose() }}
          className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-ink-2 hover:bg-surface-2 transition-colors cursor-pointer">
          <Icon name="edit" size={13} />Editar
        </button>
      )}
      {appt.Status !== 'cancelado' && (
        <button onClick={() => { onOpenComanda(appt); onClose() }}
          className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-ink-2 hover:bg-surface-2 transition-colors cursor-pointer">
          <Icon name="receipt" size={13} />Abrir comanda
        </button>
      )}
      {appt.Status === 'concluido' && canFecharConta && (
        <button onClick={() => { onFecharConta(appt); onClose() }}
          className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-success hover:bg-surface-2 transition-colors cursor-pointer">
          <Icon name="cash" size={13} />Fechar comanda
        </button>
      )}
      <button onClick={() => { onNavigate(appt); onClose() }}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-ink-3 hover:bg-surface-2 transition-colors cursor-pointer">
        <Icon name="arrowRight" size={13} />Ver detalhes
      </button>
      {appt.Status === 'cancelado' && (
        <>
          <div className="border-t border-line my-1" />
          <button onClick={() => { onDelete(appt); onClose() }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-danger hover:bg-surface-2 transition-colors cursor-pointer">
            <Icon name="trash" size={13} />Excluir agendamento
          </button>
        </>
      )}
    </div>
  )
}

function NovoAgendamentoDrawer({ slot, professional, date, workingHour, onClose, onSaved }) {
  const { addToast } = useToast()
  const { user: authUser } = useAuthStore()
  const [offHoursWarning, setOffHoursWarning] = useState(null)
  const [servicos, setServicos]     = useState([])
  const [clienteId, setClienteId]   = useState('')
  const [clienteOption, setClienteOption] = useState(null)
  const [itens, setItens] = useState([{ servicoId: '', startTime: slot, endTime: addMinutes(slot, 60), assistantId: '', assistantPct: '' }])
  const [isUrgent, setIsUrgent]     = useState(false)
  const [recurring, setRecurring]   = useState(false)
  const [frequency, setFrequency]   = useState('semanal')
  const [notes, setNotes]           = useState('')
  const [saving, setSaving]         = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [modalCliente, setModalCliente] = useState(false)
  const [assistantCandidates, setAssistantCandidates] = useState([])

  // Candidatas a assistente: qualquer profissional (não só as que fazem o serviço).
  useEffect(() => {
    Promise.all([
      api.get('/users', { params: { Role: 'Profissional', limit: 100 } }),
      api.get('/users', { params: { Role: 'Admin', limit: 100 } }),
    ])
      .then(([p, a]) => setAssistantCandidates(
        excludeMonitorAdmins([...(a.data.data ?? []), ...(p.data.data ?? [])]).map(u => ({ UUID: u.UUID, Name: u.Name }))
      ))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!authUser?.id) return
    setLoadingData(true)
    api.get('/service', { params: { professional: authUser.id, limit: 100 } })
      .then(({ data }) => setServicos(data.data ?? []))
      .catch(() => {})
      .finally(() => setLoadingData(false))
  }, [authUser?.id])

  function handleClienteCriado(cliente) {
    setClienteId(cliente.UUID)
    setClienteOption({ value: cliente.UUID, label: cliente.Name })
  }

  function handleServico(index, id, lista) {
    setItens(prev => {
      const next = [...prev]
      const item = { ...next[index], servicoId: id }
      const svc = (lista ?? servicos).find(s => s.UUID === id)
      item.assistantPct = svc?.Assistant_commission != null ? String(svc.Assistant_commission) : ''
      if (svc?.Duration) {
        const [h, m] = svc.Duration.split(':').map(Number)
        item.endTime = addMinutes(item.startTime, h * 60 + m)
      }
      next[index] = item
      if (next[index + 1]) next[index + 1] = { ...next[index + 1], startTime: item.endTime }
      return next
    })
  }

  function handleItemStartTime(index, value) {
    setItens(prev => {
      const next = [...prev]
      next[index] = { ...next[index], startTime: value }
      return next
    })
  }

  function handleItemEndTime(index, value) {
    setItens(prev => {
      const next = [...prev]
      next[index] = { ...next[index], endTime: value }
      if (next[index + 1]) next[index + 1] = { ...next[index + 1], startTime: value }
      return next
    })
  }

  function addItem() {
    setItens(prev => {
      const last = prev[prev.length - 1]
      return [...prev, { servicoId: '', startTime: last.endTime, endTime: addMinutes(last.endTime, 60), assistantId: '', assistantPct: '' }]
    })
  }

  function handleAssistant(index, assistantId) {
    setItens(prev => prev.map((it, i) => i === index ? { ...it, assistantId } : it))
  }

  function handleAssistantPct(index, assistantPct) {
    setItens(prev => prev.map((it, i) => i === index ? { ...it, assistantPct } : it))
  }

  function removeItem(index) {
    setItens(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSalvar(skipOffHoursCheck = false) {
    if (!clienteId || itens.some(it => !it.servicoId)) return addToast('Preencha cliente e todos os serviços', 'warning')
    if (itens.some(it => it.assistantId && it.assistantPct === '')) return addToast('Informe a comissão da assistente', 'warning')

    // Aviso, não bloqueio — o profissional pode encaixar fora do próprio expediente
    // desde que confirme (ver decisions.md).
    if (!skipOffHoursCheck) {
      const warning = buildOutsideHoursWarning(
        itens.map(it => ({
          professionalId: professional?.UUID ?? authUser?.id,
          professionalName: 'Você',
          startTime: it.startTime,
          endTime: it.endTime,
        })),
        { [professional?.UUID ?? authUser?.id]: workingHour ?? null }
      )
      if (warning) return setOffHoursWarning(warning)
    }

    setOffHoursWarning(null)
    setSaving(true)
    try {
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      await api.post('/appointment/batch', {
        Client: clienteId,
        Date: dateStr,
        Is_urgent: isUrgent,
        Notes: notes.trim() || undefined,
        Recurring: recurring || undefined,
        Frequency: recurring ? frequency : undefined,
        Items: itens.map(item => ({
          Professional: professional.UUID,
          Service: item.servicoId,
          Start_time: item.startTime,
          End_time: item.endTime,
          ...(item.assistantId ? assistantPayload(item) : {}),
        })),
      })
      addToast(recurring ? 'Agendamento recorrente criado!' : itens.length > 1 ? `${itens.length} serviços agendados!` : 'Agendamento criado!')
      onSaved()
      onClose()
    } catch (err) {
      addToast(err.response?.data?.error ?? 'Erro ao criar agendamento', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {modalCliente && (
        <ModalNovoCliente onClose={() => setModalCliente(false)} onCreated={handleClienteCriado} />
      )}
      <Modal
        isOpen={!!offHoursWarning}
        onClose={() => setOffHoursWarning(null)}
        onConfirm={() => handleSalvar(true)}
        title="Fora do horário de trabalho"
        message={offHoursWarning}
        confirmLabel="Agendar mesmo assim"
      />
<div className="fixed inset-0 z-40 flex flex-col justify-end md:flex-row md:justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-10 w-full rounded-t-2xl md:rounded-none md:w-[420px] bg-bg md:border-l border-line flex flex-col max-h-[90vh] md:max-h-full md:h-full overflow-y-auto shadow-xl">
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
            <h4 className="font-display font-medium text-[15px] tracking-tight">Novo agendamento</h4>
            <p className="text-[11px] text-ink-3 font-mono">{professional.Name} · {slot}</p>
          </div>
        </div>

        <div className="px-5 py-5 flex flex-col gap-4">
          {/* Cliente */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-ink-2">Cliente</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setModalCliente(true)}
                className="flex-shrink-0 w-[42px] h-[42px] flex items-center justify-center rounded-md border border-line bg-surface text-brand hover:bg-brand-soft hover:border-brand/30 transition-colors cursor-pointer"
              >
                <Icon name="plus" size={16} />
              </button>
              <SearchableSelect
                value={clienteId}
                onChange={setClienteId}
                onSearch={searchClients}
                injectOption={clienteOption}
                placeholder="Selecionar cliente…"
                className="flex-1"
              />
            </div>
          </div>

          {/* Serviços — filtrados pelo profissional */}
          {itens.map((item, i) => (
            <div key={i} className="flex flex-col gap-3 pb-3 border-b border-line last:border-b-0 last:pb-0">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[12px] font-medium text-ink-2">
                    {itens.length > 1 ? `Serviço ${i + 1}` : 'Serviço'}
                  </label>
                  {itens.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(i)}
                      className="text-ink-3 hover:text-danger transition-colors cursor-pointer"
                    >
                      <Icon name="x" size={14} />
                    </button>
                  )}
                </div>
                <SearchableSelect
                  value={item.servicoId}
                  onChange={(id) => handleServico(i, id)}
                  disabled={loadingData || servicos.length === 0}
                  options={servicos.map(s => ({ value: s.UUID, label: s.Name }))}
                  placeholder={loadingData ? 'Carregando…' : servicos.length === 0 ? 'Nenhum serviço vinculado a você' : 'Selecionar serviço…'}
                />
              </div>
              {item.servicoId && (
                <AssistantField
                  candidates={assistantCandidates}
                  excludeId={professional.UUID}
                  assistantId={item.assistantId}
                  pct={item.assistantPct}
                  onAssistant={(id) => handleAssistant(i, id)}
                  onPct={(v) => handleAssistantPct(i, v)}
                />
              )}

              {/* Horários */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-medium text-ink-2">Início</label>
                  <input type="time" value={item.startTime} onChange={e => handleItemStartTime(i, e.target.value)} className={INPUT_CLS} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-medium text-ink-2">Fim</label>
                  <input type="time" value={item.endTime} onChange={e => handleItemEndTime(i, e.target.value)} className={INPUT_CLS} />
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addItem}
            className="flex items-center justify-center gap-1.5 w-full h-[38px] rounded-md border border-dashed border-line text-[13px] font-medium text-ink-3 hover:text-brand hover:border-brand/30 transition-colors cursor-pointer"
          >
            <Icon name="plus" size={14} />
            Adicionar serviço
          </button>

          {/* Profissional read-only */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-ink-2">Profissional</label>
            <div className="flex items-center gap-2.5 h-[42px] px-[14px] rounded-md border border-line bg-surface-2 text-ink-3 text-md">
              <Avatar name={professional.Name} index={0} size="sm" />
              {professional.Name}
            </div>
          </div>

          {/* Urgência — mutuamente exclusivo com Recorrência (backend rejeita a combinação) */}
          <button
            type="button"
            onClick={() => setIsUrgent(v => {
              const next = !v
              if (next) setRecurring(false)
              return next
            })}
            className={`flex items-center gap-3 w-full px-4 py-3 rounded-[10px] border transition-colors cursor-pointer text-left
              ${isUrgent ? 'bg-warning-soft border-warning/40' : 'bg-surface border-line hover:border-ink-3'}`}
          >
            <div className={`w-4 h-4 rounded flex items-center justify-center border flex-shrink-0 transition-colors
              ${isUrgent ? 'bg-warning border-warning' : 'border-line-2'}`}>
              {isUrgent && <Icon name="check" size={10} className="text-white" />}
            </div>
            <div>
              <div className={`text-[13px] font-medium ${isUrgent ? 'text-warning' : 'text-ink-2'}`}>Agendamento urgente</div>
              <div className="text-[11px] text-ink-3">Permite sobrepor horários já ocupados</div>
            </div>
          </button>

          {/* Recorrência — desabilitada (não escondida) quando Urgente está marcado,
              para deixar claro que a incompatibilidade é intencional, não um bug. */}
          <div className={`flex flex-col gap-2 ${isUrgent ? 'opacity-50 pointer-events-none' : ''}`}>
            <button
              type="button"
              onClick={() => setRecurring(v => !v)}
              disabled={isUrgent}
              className={`flex items-center gap-3 w-full px-4 py-3 rounded-[10px] border transition-colors cursor-pointer text-left
                ${recurring ? 'bg-brand-soft border-brand/40' : 'bg-surface border-line hover:border-ink-3'}`}
            >
              <div className={`w-4 h-4 rounded flex items-center justify-center border flex-shrink-0 transition-colors
                ${recurring ? 'bg-brand border-brand' : 'border-line-2'}`}>
                {recurring && <Icon name="check" size={10} className="text-white" />}
              </div>
              <div>
                <div className={`text-[13px] font-medium ${recurring ? 'text-brand' : 'text-ink-2'}`}>Agendamento recorrente</div>
                <div className="text-[11px] text-ink-3">
                  {isUrgent ? 'Indisponível com Agendamento urgente' : 'Repete automaticamente na mesma data/horário'}
                </div>
              </div>
            </button>
            {recurring && !isUrgent && (
              <div className="flex flex-col gap-1.5 pl-1">
                <label className="text-[12px] font-medium text-ink-2">Frequência</label>
                <select
                  value={frequency}
                  onChange={e => setFrequency(e.target.value)}
                  className="w-full h-[42px] px-[14px] rounded-md border border-line bg-surface text-ink-2 font-body text-md focus:outline-none focus:border-brand transition-colors"
                >
                  <option value="semanal">Semanal</option>
                  <option value="quinzenal">Quinzenal</option>
                  <option value="mensal">Mensal</option>
                </select>
              </div>
            )}
          </div>

          {/* Observação */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-ink-2">Observação <span className="text-ink-4 font-normal">(opcional)</span></label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ex: cliente prefere água morna, trouxe produto próprio…"
              rows={2}
              maxLength={1000}
              className="w-full px-[14px] py-[10px] rounded-md border border-line bg-surface text-ink-2 font-body text-md placeholder:text-ink-4 focus:outline-none focus:border-brand transition-colors resize-none"
            />
          </div>

          {/* Arrow function obrigatória — o evento do clique cairia em skipOffHoursCheck */}
          <Button onClick={() => handleSalvar()} loading={saving} className="w-full mt-2">
            Confirmar agendamento
          </Button>
        </div>
      </div>
    </div>
    </>
  )
}

function FolgaDrawer({ date, professionalId, leave, onClose, onSaved }) {
  const { addToast } = useToast()
  const isEdit = !!leave
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  const [form, setForm] = useState(isEdit
    ? {
      date: leave.Date,
      all_day: leave.All_day,
      start_time: leave.Start_time?.slice(0, 5) ?? '08:00',
      end_time: leave.End_time?.slice(0, 5) ?? '12:00',
      reason: leave.Reason ?? ''
    }
    : { date: dateStr, all_day: true, start_time: '08:00', end_time: '12:00', reason: '' })
  const [saving, setSaving] = useState(false)

  async function handleSalvar(e) {
    e.preventDefault()
    setSaving(true)
    try {
      if (isEdit) {
        const body = { date: form.date, all_day: form.all_day, reason: form.reason || null }
        if (!form.all_day) { body.start_time = form.start_time; body.end_time = form.end_time }
        else { body.start_time = null; body.end_time = null }
        await api.patch(`/professional-leave/${leave.UUID}`, body)
        addToast('Folga atualizada', 'success')
      } else {
        const body = { professional_id: professionalId, date: form.date, all_day: form.all_day, reason: form.reason || null }
        if (!form.all_day) { body.start_time = form.start_time; body.end_time = form.end_time }
        await api.post('/professional-leave', body)
        addToast('Folga registrada', 'success')
      }
      onSaved()
      onClose()
    } catch (err) {
      addToast(err.response?.data?.error ?? 'Erro ao salvar folga', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end md:flex-row md:justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-10 w-full rounded-t-2xl md:rounded-none md:w-[420px] bg-bg md:border-l border-line flex flex-col max-h-[90vh] md:max-h-full md:h-full overflow-y-auto shadow-xl">
        <div className="flex justify-center pt-3 pb-1 md:hidden"><div className="w-10 h-1 rounded-full bg-line-2" /></div>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-line sticky top-0 bg-bg z-10">
          <button onClick={onClose} className="text-ink-3 hover:text-ink transition-colors cursor-pointer"><Icon name="x" size={18} /></button>
          <h4 className="font-display font-medium text-[15px] tracking-tight">{isEdit ? 'Editar folga' : 'Registrar folga'}</h4>
        </div>
        <form onSubmit={handleSalvar} className="px-5 py-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-ink-2">Data</label>
            <input type="date" required value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={INPUT_CLS} />
          </div>
          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, all_day: !f.all_day }))}
            className={`flex items-center gap-3 w-full px-4 py-3 rounded-[10px] border transition-colors cursor-pointer text-left
              ${form.all_day ? 'bg-brand-soft border-brand/30' : 'bg-surface border-line hover:border-ink-3'}`}
          >
            <div className={`w-4 h-4 rounded flex items-center justify-center border flex-shrink-0 transition-colors
              ${form.all_day ? 'bg-brand border-brand' : 'border-line-2'}`}>
              {form.all_day && <Icon name="check" size={10} className="text-white" />}
            </div>
            <div>
              <div className={`text-[13px] font-medium ${form.all_day ? 'text-brand' : 'text-ink-2'}`}>Ocupa o dia inteiro</div>
              <div className="text-[11px] text-ink-3">Bloqueia toda a agenda do dia</div>
            </div>
          </button>
          {!form.all_day && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-medium text-ink-2">Início</label>
                <input type="time" required value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} className={INPUT_CLS} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-medium text-ink-2">Fim</label>
                <input type="time" required value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} className={INPUT_CLS} />
              </div>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-ink-2">Motivo <span className="text-ink-4 font-normal">(opcional)</span></label>
            <textarea
              value={form.reason}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              placeholder="Ex: Consulta médica"
              rows={2}
              className="w-full px-[14px] py-[10px] rounded-md border border-line bg-surface text-ink-2 font-body text-md placeholder:text-ink-4 focus:outline-none focus:border-brand transition-colors resize-none"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="ghost" className="flex-1 justify-center" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="flex-1 justify-center" loading={saving}>{isEdit ? 'Salvar' : 'Registrar'}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function TransferirDrawer({ appt, onClose, onSaved }) {
  const { addToast } = useToast()

  const [newDate, setNewDate] = useState(appt.Date)
  const [itens, setItens] = useState(() => {
    const apptServices = appt.Services?.length > 0
      ? appt.Services
      : [{ UUID: appt.Service_id, Start_time: appt.Start_time, End_time: appt.End_time }]
    // itemId vale pra todo item, inclusive o 1º — sem ele não dá pra remover a âncora do
    // bloco (o item seguinte assume o lugar dela; ver handleSalvar).
    return apptServices.map((s, i) => ({
      itemId: s.Item_id ?? null,
      isNew: false,
      servicoId: s.UUID ?? '',
      startTime: (s.Start_time ?? appt.Start_time).slice(0, 5),
      endTime: (s.End_time ?? appt.End_time).slice(0, 5),
      professionalId: appt.Professional_id ?? '',
      assistantId: s.Assistant_id ?? '',
      assistantPct: s.Assistant_commission != null ? String(s.Assistant_commission) : '',
    }))
  })
  const [isUrgent, setIsUrgent] = useState(false)
  const [recurring, setRecurring] = useState(false)
  const [frequency, setFrequency] = useState('semanal')
  const [cancelingRecurring, setCancelingRecurring] = useState(false)
  const [saving, setSaving] = useState(false)
  const [offHoursWarning, setOffHoursWarning] = useState(null)
  const [checkingHours, setCheckingHours] = useState(false)
  // Por item: { services, loadingServices, professionalOptions, loadingProfessionals }
  const [itemMeta, setItemMeta] = useState({})
  const [assistantCandidates, setAssistantCandidates] = useState([])
  // Itens que já existiam no bloco e foram explicitamente excluídos (saem de `itens` no
  // clique) — precisam ir em Remove_services no save, diferente de item novo removido
  // (nunca existiu no backend, só é descartado).
  const removedExistingIdsRef = useRef([])

  // Candidatas a assistente: qualquer profissional (não só as que fazem o serviço).
  useEffect(() => {
    Promise.all([
      api.get('/users', { params: { Role: 'Profissional', limit: 100 } }),
      api.get('/users', { params: { Role: 'Admin', limit: 100 } }),
    ])
      .then(([p, a]) => setAssistantCandidates(
        excludeMonitorAdmins([...(a.data.data ?? []), ...(p.data.data ?? [])]).map(u => ({ UUID: u.UUID, Name: u.Name }))
      ))
      .catch(() => {})
  }, [])
  async function handleCancelRecurring() {
    setCancelingRecurring(true)
    try {
      await api.delete(`/recurring-appointment/${appt.Recurring_appointment_id}`)
      addToast('Recorrência cancelada')
      onSaved()
      onClose()
    } catch (err) {
      addToast(err.response?.data?.error ?? 'Erro ao cancelar recorrência', 'error')
    } finally {
      setCancelingRecurring(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    itens.forEach((it, i) => {
      if (it.professionalId) {
        setItemMeta(prev => ({ ...prev, [i]: { ...prev[i], loadingServices: true } }))
        api.get('/service', { params: { professional: it.professionalId, limit: 100 } })
          .then(({ data }) => {
            if (cancelled) return
            setItemMeta(prev => ({ ...prev, [i]: { ...prev[i], services: data.data ?? [], loadingServices: false } }))
          })
          .catch(() => {
            if (cancelled) return
            setItemMeta(prev => ({ ...prev, [i]: { ...prev[i], services: [], loadingServices: false } }))
          })
      }
      if (it.servicoId) {
        setItemMeta(prev => ({ ...prev, [i]: { ...prev[i], loadingProfessionals: true } }))
        api.get(`/service/${it.servicoId}/professionals`)
          .then(({ data }) => {
            if (cancelled) return
            setItemMeta(prev => ({ ...prev, [i]: { ...prev[i], professionalOptions: data.data ?? [], loadingProfessionals: false } }))
          })
          .catch(() => {
            if (cancelled) return
            setItemMeta(prev => ({ ...prev, [i]: { ...prev[i], professionalOptions: [], loadingProfessionals: false } }))
          })
      } else {
        // Item novo (ainda sem serviço escolhido): não dá pra buscar profissionais
        // por /service/:id/professionals sem um servicoId, então usa a lista geral
        // — senão o select de profissional fica travado até o serviço ser escolhido,
        // impedindo trocar a profissional de um item recém-adicionado. Mesma lógica
        // de DetalhesAgendamento.jsx/AdminAgenda.jsx — as telas devem se comportar igual.
        setItemMeta(prev => ({ ...prev, [i]: { ...prev[i], loadingProfessionals: true } }))
        Promise.all([
          api.get('/users', { params: { Role: 'Profissional' } }),
          api.get('/users', { params: { Role: 'Admin' } }),
        ])
          .then(([profRes, adminRes]) => {
            if (cancelled) return
            const list = excludeMonitorAdmins([...(adminRes.data.data ?? []), ...(profRes.data.data ?? [])])
              .map(u => ({ professional_id: u.UUID, name: u.Name }))
            setItemMeta(prev => ({ ...prev, [i]: { ...prev[i], professionalOptions: list, loadingProfessionals: false } }))
          })
          .catch(() => {
            if (cancelled) return
            setItemMeta(prev => ({ ...prev, [i]: { ...prev[i], professionalOptions: [], loadingProfessionals: false } }))
          })
      }
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itens.map(it => `${it.professionalId}|${it.servicoId}`).join(',')])

  function handleServico(index, id) {
    setItens(prev => {
      const next = [...prev]
      const item = { ...next[index], servicoId: id }
      const svc = itemMeta[index]?.services?.find(s => s.UUID === id)
      if (svc) {
        item.assistantPct = svc.Assistant_commission != null ? String(svc.Assistant_commission) : ''
      }
      if (svc?.Duration) {
        const [h, m] = svc.Duration.split(':').map(Number)
        item.endTime = addMinutes(item.startTime, h * 60 + m)
      }
      next[index] = item
      if (next[index + 1]) next[index + 1] = { ...next[index + 1], startTime: item.endTime }
      return next
    })
  }

  function handleProfissional(index, professionalId) {
    setItens(prev => {
      const next = [...prev]
      // a principal não pode ser a própria assistente
      const assistantId = next[index].assistantId === professionalId ? '' : next[index].assistantId
      next[index] = { ...next[index], professionalId, assistantId }
      return next
    })
  }

  function handleItemStartTime(index, value) {
    setItens(prev => {
      const next = [...prev]
      next[index] = { ...next[index], startTime: value }
      return next
    })
  }

  function handleItemEndTime(index, value) {
    setItens(prev => {
      const next = [...prev]
      next[index] = { ...next[index], endTime: value }
      if (next[index + 1]) next[index + 1] = { ...next[index + 1], startTime: value }
      return next
    })
  }

  function addItem() {
    setItens(prev => {
      const last = prev[prev.length - 1]
      return [...prev, { id: null, itemId: null, isNew: true, servicoId: '', startTime: last.endTime, endTime: addMinutes(last.endTime, 60), professionalId: last.professionalId, assistantId: '', assistantPct: '' }]
    })
  }

  function handleAssistant(index, assistantId) {
    setItens(prev => prev.map((it, i) => i === index ? { ...it, assistantId } : it))
  }

  function handleAssistantPct(index, assistantPct) {
    setItens(prev => prev.map((it, i) => i === index ? { ...it, assistantPct } : it))
  }

  function removeItem(index) {
    setItens(prev => {
      const it = prev[index]
      if (!it.isNew && it.itemId) removedExistingIdsRef.current.push(it.itemId)
      return prev.filter((_, i) => i !== index)
    })
  }

  async function handleSalvar(skipOffHoursCheck = false) {
    if (itens.some(it => !it.servicoId)) return addToast('Selecione o serviço em todos os itens', 'warning')
    if (itens.some(it => it.assistantId && it.assistantPct === '')) return addToast('Informe a comissão da assistente', 'warning')
    if (itens.some(it => !it.professionalId)) return addToast('Selecione a profissional em todos os itens', 'warning')

    // A data pode mudar na edição, então o horário de trabalho do dia da semana novo
    // precisa ser buscado aqui. Aviso, não bloqueio (ver decisions.md).
    if (!skipOffHoursCheck) {
      setCheckingHours(true)
      try {
        const [y, m, d] = newDate.split('-').map(Number)
        const weekday = new Date(y, m - 1, d).getDay()
        const whByProf = await fetchWorkingHours([...new Set(itens.map(it => it.professionalId))], weekday)
        const warning = buildOutsideHoursWarning(
          itens.map((it, i) => ({
            professionalId: it.professionalId,
            professionalName: (itemMeta[i]?.professionalOptions ?? []).find(p => p.professional_id === it.professionalId)?.name ?? appt.Professional,
            startTime: it.startTime,
            endTime: it.endTime,
          })),
          whByProf
        )
        if (warning) {
          setCheckingHours(false)
          return setOffHoursWarning(warning)
        }
      } catch { /* checagem é só um aviso — não pode impedir a edição */ }
      setCheckingHours(false)
    }

    setOffHoursWarning(null)
    setSaving(true)
    try {
      const [original, ...rest] = itens
      const anchorProf = original.professionalId
      // Itens que ficam na MESMA profissional do bloco: fundidos no mesmo Appointment
      // (Add_services p/ novos, Update_services p/ já existentes) — 1 card só na Agenda,
      // 1 Tab só ao concluir. Itens com profissional DIFERENTE saem do bloco (Remove_services
      // quando já existiam) e viram Appointments próprios, ligados pelo mesmo Booking_group
      // — cobre o caso de 1 serviço do atendimento precisar de outra profissional.
      const sameProf = rest.filter(it => it.professionalId === anchorProf)
      const diffProf = rest.filter(it => it.professionalId !== anchorProf)

      const newItens = sameProf.filter(it => it.isNew)
      const updateItens = sameProf.filter(it => !it.isNew && it.itemId)
      const updateAll = [...(original.itemId ? [original] : []), ...updateItens]
      const newStandalone = diffProf.filter(it => it.isNew)
      const removedStandalone = diffProf.filter(it => !it.isNew && it.itemId)
      // Serviços excluídos de vez (botão x em item já existente, sem troca de profissional)
      // — vão em Remove_services junto com removedStandalone, mas NÃO entram no loop de
      // recriação abaixo: o serviço deve sumir, não virar um Appointment novo.
      const allRemovedIds = [...new Set([
        ...removedStandalone.map(it => it.itemId),
        ...removedExistingIdsRef.current,
      ])]

      let bookingGroup = appt.Booking_group
      if ((newStandalone.length > 0 || removedStandalone.length > 0) && !bookingGroup) {
        bookingGroup = crypto.randomUUID()
      }

      await api.patch(`/appointment/${appt.UUID}`, {
        Service: original.servicoId,
        Professional: anchorProf,
        Date: newDate,
        Start_time: original.startTime,
        End_time: original.endTime,
        Is_urgent: isUrgent,
        ...(recurring && !appt.Recurring_appointment_id ? { Recurring: true, Frequency: frequency } : {}),
        ...(newItens.length > 0 ? {
          Add_services: newItens.map(it => ({ Service: it.servicoId, Start_time: it.startTime, End_time: it.endTime, ...assistantPayload(it) }))
        } : {}),
        // o 1º item também entra: o PATCH principal atualiza serviço/horário dele, mas a assistente
        // só é gravada via Update_services
        ...(updateAll.length > 0 ? {
          Update_services: updateAll.map(it => ({ Id: it.itemId, Service: it.servicoId, Start_time: it.startTime, End_time: it.endTime, ...assistantPayload(it) }))
        } : {}),
        ...(allRemovedIds.length > 0 ? {
          Remove_services: allRemovedIds
        } : {}),
        ...(bookingGroup && bookingGroup !== appt.Booking_group ? { Booking_group: bookingGroup } : {}),
      })

      for (const it of [...newStandalone, ...removedStandalone]) {
        await api.post('/appointment', {
          Client: appt.Client_id,
          Professional: it.professionalId,
          Service: it.servicoId,
          Date: newDate,
          Start_time: it.startTime,
          End_time: it.endTime,
          Is_urgent: isUrgent,
          Booking_group: bookingGroup,
        })
      }
      addToast('Agendamento atualizado com sucesso', 'success')
      onSaved()
      onClose()
    } catch (err) {
      if (err.response?.status === 409) {
        addToast('Já existe um agendamento nesse horário. Marque "Agendamento urgente" para sobrepor.', 'error')
      } else {
        addToast(err.response?.data?.error ?? 'Erro ao atualizar agendamento', 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'h-[42px] px-[14px] rounded-md border border-line bg-surface text-ink-2 font-body text-md focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/12 transition-colors w-full'

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 md:inset-y-0 md:right-0 md:left-auto md:w-[400px] flex flex-col bg-surface border-t border-line md:border-t-0 md:border-l rounded-t-2xl md:rounded-none shadow-xl">
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 rounded-full bg-line-2" />
        </div>
        <div className="flex items-start justify-between px-5 md:px-7 py-4 md:py-6 border-b border-line">
          <div>
            <span className="font-mono text-[10.5px] uppercase tracking-widest text-ink-3">Editar agendamento</span>
            <h4 className="font-display font-medium text-[18px] tracking-tight mt-0.5">{appt.Client}</h4>
          </div>
          <button onClick={onClose} className="text-ink-3 hover:text-ink transition-colors cursor-pointer mt-1">
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 md:px-7 py-5 space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-ink-2">Data</label>
            <input type="date" value={newDate} min={new Date().toISOString().slice(0, 10)}
              onChange={e => setNewDate(e.target.value)} className={inputClass} />
          </div>

          {itens.map((item, i) => (
            <div key={i} className="flex flex-col gap-3 pb-3 border-b border-line last:border-b-0 last:pb-0">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[12px] font-medium text-ink-2">
                    {itens.length > 1 ? `Serviço ${i + 1}` : 'Serviço'}
                  </label>
                  {itens.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(i)}
                      className="text-ink-3 hover:text-danger transition-colors cursor-pointer"
                      title={item.isNew ? 'Cancelar item' : 'Remover serviço do agendamento'}
                    >
                      <Icon name="x" size={14} />
                    </button>
                  )}
                </div>
                <SearchableSelect
                  value={item.professionalId}
                  onChange={(pid) => handleProfissional(i, pid)}
                  disabled={itemMeta[i]?.loadingProfessionals || !(itemMeta[i]?.professionalOptions?.length > 0)}
                  options={(itemMeta[i]?.professionalOptions ?? []).map(p => ({ value: p.professional_id, label: p.name }))}
                  placeholder={itemMeta[i]?.loadingProfessionals ? 'Carregando…' : 'Selecione a profissional'}
                />
                <SearchableSelect
                  value={item.servicoId}
                  onChange={(id) => handleServico(i, id)}
                  disabled={itemMeta[i]?.loadingServices || !(itemMeta[i]?.services?.length > 0)}
                  options={(itemMeta[i]?.services ?? []).map(s => ({ value: s.UUID, label: s.Name }))}
                  placeholder={itemMeta[i]?.loadingServices ? 'Carregando…' : 'Selecione o serviço'}
                />
              </div>
              {item.servicoId && (
                <AssistantField
                  candidates={assistantCandidates}
                  excludeId={item.professionalId}
                  assistantId={item.assistantId}
                  pct={item.assistantPct}
                  onAssistant={(id) => handleAssistant(i, id)}
                  onPct={(v) => handleAssistantPct(i, v)}
                />
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-medium text-ink-2">Início</label>
                  <input type="time" value={item.startTime} onChange={e => handleItemStartTime(i, e.target.value)} className={inputClass} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-medium text-ink-2">Término</label>
                  <input type="time" value={item.endTime} onChange={e => handleItemEndTime(i, e.target.value)} className={inputClass} />
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addItem}
            className="flex items-center justify-center gap-1.5 w-full h-[38px] rounded-md border border-dashed border-line text-[13px] font-medium text-ink-3 hover:text-brand hover:border-brand/30 transition-colors cursor-pointer"
          >
            <Icon name="plus" size={14} />
            Adicionar serviço
          </button>

          <button
            type="button"
            onClick={() => setIsUrgent(v => {
              const next = !v
              if (next) setRecurring(false)
              return next
            })}
            className={`flex items-center gap-3 w-full px-4 py-3 rounded-[10px] border transition-colors cursor-pointer text-left
              ${isUrgent ? 'bg-warning-soft border-warning/40' : 'bg-surface border-line hover:border-ink-3'}`}
          >
            <div className={`w-4 h-4 rounded flex items-center justify-center border flex-shrink-0 transition-colors
              ${isUrgent ? 'bg-warning border-warning' : 'border-line-2'}`}>
              {isUrgent && <Icon name="check" size={10} className="text-white" />}
            </div>
            <div>
              <div className={`text-[13px] font-medium ${isUrgent ? 'text-warning' : 'text-ink-2'}`}>Agendamento urgente</div>
              <div className="text-[11px] text-ink-3">Permite sobrepor horários já ocupados</div>
            </div>
          </button>

          {/* Recorrência — tornar recorrente (se ainda não é) ou remover a recorrência
              (se já é), direto do fluxo de edição. */}
          {appt.Recurring_appointment_id ? (
            <button
              type="button"
              onClick={handleCancelRecurring}
              disabled={cancelingRecurring}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-[10px] border border-danger/30 bg-danger-soft text-left hover:border-danger/50 transition-colors cursor-pointer disabled:opacity-60"
            >
              <Icon name="x" size={14} className="text-danger flex-shrink-0" />
              <div>
                <div className="text-[13px] font-medium text-danger">{cancelingRecurring ? 'Removendo…' : 'Remover recorrência'}</div>
                <div className="text-[11px] text-ink-3">Para de repetir automaticamente — as próximas ocorrências já marcadas são canceladas</div>
              </div>
            </button>
          ) : (
            <div className={`flex flex-col gap-2 ${isUrgent ? 'opacity-50 pointer-events-none' : ''}`}>
              <button
                type="button"
                onClick={() => setRecurring(v => !v)}
                disabled={isUrgent}
                className={`flex items-center gap-3 w-full px-4 py-3 rounded-[10px] border transition-colors cursor-pointer text-left
                  ${recurring ? 'bg-brand-soft border-brand/40' : 'bg-surface border-line hover:border-ink-3'}`}
              >
                <div className={`w-4 h-4 rounded flex items-center justify-center border flex-shrink-0 transition-colors
                  ${recurring ? 'bg-brand border-brand' : 'border-line-2'}`}>
                  {recurring && <Icon name="check" size={10} className="text-white" />}
                </div>
                <div>
                  <div className={`text-[13px] font-medium ${recurring ? 'text-brand' : 'text-ink-2'}`}>Tornar recorrente</div>
                  <div className="text-[11px] text-ink-3">
                    {isUrgent ? 'Indisponível com Agendamento urgente' : 'Repete automaticamente na mesma data/horário'}
                  </div>
                </div>
              </button>
              {recurring && !isUrgent && (
                <div className="flex flex-col gap-1.5 pl-1">
                  <label className="text-[12px] font-medium text-ink-2">Frequência</label>
                  <select
                    value={frequency}
                    onChange={e => setFrequency(e.target.value)}
                    className="w-full h-[42px] px-[14px] rounded-md border border-line bg-surface text-ink-2 font-body text-md focus:outline-none focus:border-brand transition-colors"
                  >
                    <option value="semanal">Semanal</option>
                    <option value="quinzenal">Quinzenal</option>
                    <option value="mensal">Mensal</option>
                  </select>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="px-5 md:px-7 py-4 md:py-5 border-t border-line">
          {/* Arrow function obrigatória — o evento do clique cairia em skipOffHoursCheck */}
          <Button onClick={() => handleSalvar()} loading={saving || checkingHours} className="w-full justify-center">
            <Icon name="edit" size={14} />Salvar alterações
          </Button>
        </div>
      </div>

      {/* Depois do drawer (z-50) para o modal ficar por cima dele */}
      <Modal
        isOpen={!!offHoursWarning}
        onClose={() => setOffHoursWarning(null)}
        onConfirm={() => handleSalvar(true)}
        title="Fora do horário de trabalho"
        message={offHoursWarning}
        confirmLabel="Salvar mesmo assim"
      />
    </>
  )
}

export default function ProfissionalAgenda() {
  const { salonSlug } = useParams()
  const { user } = useAuthStore()
  const navigate  = useNavigate()
  const { addToast } = useToast()

  const [date, setDate] = useState(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })
  const [appointments, setAppointments] = useState([])
  const [workingHour, setWorkingHour]   = useState(null)
  // Sem isso, workingHour=null antes do fetch terminar faria a grade inteira aparecer
  // como "fora do expediente" por um instante.
  const [whLoaded, setWhLoaded]         = useState(false)
  const [leaves, setLeaves]             = useState([])
  const [loading, setLoading]           = useState(true)
  const { restartTour } = useTour('profissional', profissionalSteps, !loading)
  const [newSlot, setNewSlot]           = useState(null)
  const [contextMenu, setContextMenu]   = useState(null)
  const [leaveMenu, setLeaveMenu]       = useState(null)
  const [transferAppt, setTransferAppt] = useState(null)
  const [deleteAppt, setDeleteAppt]     = useState(null)
  const [deleting, setDeleting]         = useState(false)
  const [folgaDrawer, setFolgaDrawer]   = useState(false)
  const [fecharContaClient, setFecharContaClient] = useState(null)
  const [fecharContaPaying, setFecharContaPaying] = useState(false)
  const longPressTimer = useRef(null)
  const dateInputRef   = useRef(null)
  const { can } = usePermission()

  // Profissional como objeto para passar ao drawer
  const professional = { UUID: user?.publicId, Name: user?.name }

  // Carrega working hours do profissional quando a data muda
  useEffect(() => {
    if (!user?.publicId) return
    const weekday = date.getDay()
    setWhLoaded(false)
    api.get(`/working-hours/professional/${user.publicId}`)
      .then(({ data }) => {
        const wh = (data.data ?? []).find(w => w.Weekday === weekday) ?? null
        setWorkingHour(wh)
      })
      .catch(() => setWorkingHour(UNKNOWN_HOURS))
      .finally(() => setWhLoaded(true))
  }, [user?.publicId, date])

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [apptRes, leaveRes] = await Promise.all([
        api.get('/appointment/my', { params: { date: toDateStr(date), limit: 50 } }),
        user?.id ? api.get(`/professional-leave/professional/${user.id}`, { params: { date: toDateStr(date) } })
          .then(r => (r.data.data ?? []).filter(l => l.Date === toDateStr(date)))
          .catch(() => []) : Promise.resolve([])
      ])
      setAppointments(apptRes.data.data ?? [])
      setLeaves(leaveRes)
    } catch {
      setAppointments([])
      setLeaves([])
    } finally {
      if (!silent) setLoading(false)
    }
  }, [date, user?.id])

  useEffect(() => { load() }, [load])

  function prevDay() { setDate(d => { const n = new Date(d); n.setDate(n.getDate() - 1); return n }) }
  function nextDay() { setDate(d => { const n = new Date(d); n.setDate(n.getDate() + 1); return n }) }

  function openLeaveMenu(e, leave) {
    e.preventDefault()
    e.stopPropagation()
    setLeaveMenu({ leave, x: e.clientX, y: e.clientY })
  }

  async function handleRemoveLeave(leave) {
    try {
      await api.delete(`/professional-leave/${leave.UUID}`)
      addToast('Folga removida', 'success')
      load(true)
    } catch (err) {
      addToast(err.response?.data?.error ?? 'Erro ao remover folga', 'error')
    }
  }

  function openContextMenu(e, appt) {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ appt, x: e.clientX, y: e.clientY })
  }
  function handleLongPressStart(e, appt) {
    const touch = e.touches[0]
    longPressTimer.current = setTimeout(() => {
      setContextMenu({ appt, x: touch.clientX, y: touch.clientY })
    }, 500)
  }
  function handleLongPressEnd() { clearTimeout(longPressTimer.current) }

  async function handleAbrirFecharConta(appt) {
    try {
      const { data } = await api.get(`/tab/client/${appt.Client_id}/account-summary`)
      if (!data.eligible) {
        addToast('Nenhuma comanda em aberto para este cliente', 'warning')
        return
      }
      setFecharContaClient(data)
    } catch (err) {
      addToast(err.response?.data?.error || 'Erro ao carregar conta do cliente', 'error')
    }
  }

  async function handleFecharConta(tabIds, orderPayments, excludedItemIds, paymentBody) {
    if (!fecharContaClient) return
    setFecharContaPaying(true)
    try {
      const { data } = await api.post('/tab/batch-pay', {
        tab_ids: tabIds,
        Payment_date: new Date().toISOString(),
        order_payments: orderPayments,
        excluded_item_ids: excludedItemIds,
        client_id: fecharContaClient.client_id,
        ...paymentBody,
      })
      const extraMsg = batchPayExtraMessage(data)
      addToast(extraMsg ? `Conta de ${fecharContaClient.client_name} fechada com sucesso. ${extraMsg}` : `Conta de ${fecharContaClient.client_name} fechada com sucesso`, 'success')
      setFecharContaClient(null)
      load(true)
    } catch (err) {
      addToast(err.response?.data?.error || 'Erro ao fechar conta', 'error')
    } finally {
      setFecharContaPaying(false)
    }
  }

  async function handleStatusChange(appt, status) {
    try {
      await api.patch(`/appointment/${appt.UUID}`, { Status: status })
      addToast(`Agendamento marcado como ${status}`)
      load(true)
    } catch (err) {
      addToast(err.response?.data?.error ?? 'Erro ao atualizar status', 'error')
    }
  }

  async function handleConfirmDelete() {
    if (!deleteAppt) return
    setDeleting(true)
    try {
      await api.delete(`/appointment/${deleteAppt.UUID}`)
      addToast('Agendamento excluído')
      setDeleteAppt(null)
      load(true)
    } catch (err) {
      addToast(err.response?.data?.error ?? 'Erro ao excluir agendamento', 'error')
    } finally {
      setDeleting(false)
    }
  }

  // Um Appointment com buraco no meio de Services[] (item removido pra outra profissional
  // na edição) vira N blocos visuais contíguos em vez de 1 retângulo só cobrindo tempo
  // ocioso — ver splitIntoSegments.
  const visualAppointments = useMemo(() => appointments.flatMap(splitIntoSegments), [appointments])

  // Pré-computa colunas para sobreposição — inclui urgentes (ver AdminAgenda.jsx)
  const columnMap = computeColumns(visualAppointments)

  const sidebar = (
    <Sidebar navItems={navItems} footerUser={user?.name} footerRole="Profissional" />
  )

  return (
    <AppLayout sidebar={sidebar}>
      {leaveMenu && (
        <LeaveContextMenu
          leave={leaveMenu.leave}
          x={leaveMenu.x}
          y={leaveMenu.y}
          onClose={() => setLeaveMenu(null)}
          onEdit={setFolgaDrawer}
          onRemove={handleRemoveLeave}
        />
      )}
      {contextMenu && (
        <AppointmentContextMenu
          appt={contextMenu.appt}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onStatusChange={handleStatusChange}
          onNavigate={appt => navigate(`/${salonSlug}/agendamento/${appt.UUID}`)}
          onTransfer={appt => setTransferAppt(appt)}
          onOpenComanda={appt => navigate(`/${salonSlug}/profissional/comandas?appointment=${appt.UUID}${appt.Booking_group ? `&group=${appt.Booking_group}` : ''}`)}
          onFecharConta={handleAbrirFecharConta}
          canFecharConta={can('Caixa', 'manage')}
          onDelete={setDeleteAppt}
        />
      )}
      {fecharContaClient && (
        <ModalFecharConta
          client={fecharContaClient}
          paying={fecharContaPaying}
          onClose={() => setFecharContaClient(null)}
          onConfirm={handleFecharConta}
        />
      )}
      <Modal
        isOpen={!!deleteAppt}
        onClose={() => setDeleteAppt(null)}
        onConfirm={handleConfirmDelete}
        title="Excluir agendamento"
        message={deleteAppt ? `Excluir o agendamento de ${deleteAppt.Client} (${serviceLabel(deleteAppt)})? Esta ação não pode ser desfeita.` : ''}
        confirmLabel="Excluir"
        loading={deleting}
      />
      {transferAppt && (
        <TransferirDrawer
          appt={transferAppt}
          onClose={() => setTransferAppt(null)}
          onSaved={() => load(true)}
        />
      )}
      {newSlot && (
        <NovoAgendamentoDrawer
          slot={newSlot.slot}
          professional={professional}
          date={date}
          workingHour={workingHour}
          onClose={() => setNewSlot(null)}
          onSaved={() => load(true)}
        />
      )}
      {folgaDrawer && (
        <FolgaDrawer
          date={date}
          professionalId={user.id}
          leave={typeof folgaDrawer === 'object' ? folgaDrawer : null}
          onClose={() => setFolgaDrawer(false)}
          onSaved={() => load(true)}
        />
      )}

      {/* Header */}
      <div className="flex justify-between items-end mb-5 md:mb-6">
        <div>
          <h3 className="font-display font-medium text-[22px] md:text-[26px] tracking-tight">Agenda</h3>
          <p className="text-[12px] md:text-[13px] text-ink-3 mt-1">
            {appointments.length} atendimento{appointments.length !== 1 ? 's' : ''} · {formatHeader(date)}
          </p>
          <button onClick={restartTour} className="inline-flex items-center gap-1 text-[11px] text-ink-4 hover:text-brand transition-colors mt-1.5" title="Repetir tour guiado">
            <Icon name="helpCircle" size={12} />
            Ver tour
          </button>
        </div>
        <Button size="sm" onClick={() => navigate(`/${salonSlug}/profissional/agendamentos`)}>
          <Icon name="receipt" size={14} /><span className="hidden sm:inline">Ver todos</span>
        </Button>
      </div>

      {/* Navegação de dia */}
      <div className="flex items-center gap-2 md:gap-3 mb-5 overflow-x-auto">
        <button onClick={prevDay}
          className="w-[34px] h-[34px] shrink-0 rounded-lg border border-line bg-surface text-ink-2 flex items-center justify-center hover:border-ink-3 transition-colors">
          <Icon name="arrowLeft" size={14} />
        </button>
        <div className="font-display font-medium text-[14px] md:text-[17px] truncate text-center w-[170px] md:w-[320px] shrink-0">{formatHeader(date)}</div>
        <button onClick={nextDay}
          className="w-[34px] h-[34px] shrink-0 rounded-lg border border-line bg-surface text-ink-2 flex items-center justify-center hover:border-ink-3 transition-colors">
          <Icon name="arrowRight" size={14} />
        </button>
        <div className="relative shrink-0 ml-1">
          <button
            onClick={() => dateInputRef.current?.showPicker?.() ?? dateInputRef.current?.click()}
            className="w-[34px] h-[34px] rounded-lg border border-line bg-surface text-ink-2 flex items-center justify-center hover:border-brand hover:text-brand transition-colors cursor-pointer"
            title="Ir para uma data"
          >
            <Icon name="cal" size={14} />
          </button>
          <input
            ref={dateInputRef}
            type="date"
            value={toDateStr(date)}
            onChange={e => {
              if (!e.target.value) return
              const [y, m, d] = e.target.value.split('-').map(Number)
              const nd = new Date(y, m - 1, d)
              nd.setHours(0, 0, 0, 0)
              setDate(nd)
            }}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            tabIndex={-1}
          />
        </div>
        <button
          onClick={() => { const d = new Date(); d.setHours(0, 0, 0, 0); setDate(d) }}
          className="px-3 py-1.5 shrink-0 rounded-lg border border-line bg-surface text-[12.5px] text-ink-2 hover:border-ink-3 transition-colors cursor-pointer"
        >
          Hoje
        </button>
        <button
          onClick={() => setFolgaDrawer(true)}
          className="ml-auto px-3 py-1.5 shrink-0 rounded-lg border border-line bg-surface text-[12.5px] text-ink-2 hover:border-danger hover:text-danger transition-colors cursor-pointer"
        >
          + Folga
        </button>
      </div>

      {loading ? <PageSpinner /> : (
        <>
          {/* Grade — desktop: col de hora + col do profissional */}
          <div data-tour="schedule-grid" className="bg-surface border border-line rounded-lg overflow-hidden">
            <div className="grid overflow-y-auto max-h-[70vh] scrollbar-hidden" style={{ gridTemplateColumns: '64px 1fr' }}>
              {/* Cabeçalho */}
              <div className="sticky top-0 z-30 px-3 py-3 border-b border-r border-line bg-surface-2" />
              <div className="sticky top-0 z-30 px-4 py-3 border-b border-line bg-surface-2 flex items-center gap-2.5">
                <Avatar name={user?.name ?? ''} index={0} size="sm" />
                <div className="min-w-0">
                  <div className="font-medium text-[13px] truncate">{user?.name}</div>
                  <div className={`text-[11px] truncate ${workingHour ? 'text-ink-3' : 'text-danger'}`}>
                    {workingHoursLabel(workingHour, whLoaded)}
                  </div>
                </div>
              </div>

              {/* Slots */}
              {TIME_SLOTS.map(slot => {
                const isHour    = slot.endsWith(':00')
                const appts     = visualAppointments.filter(a => anchoredToSlot(a, slot))
                const occupied  = visualAppointments.some(a => coversSlot(a, slot) && a.Status !== 'cancelado')
                const onBreak   = coversBreak(workingHour, slot)
                const onLeave   = leaveCoversSlot(leaves, slot)
                const leaveBlock = leaveStartsAt(leaves, slot)
                const breakStart = isBreakStart(workingHour, slot)
                const breakSpans = breakStart ? spanBreak(workingHour) : 0
                const past      = isSlotPast(date, slot)
                // Fora do expediente continua clicável — só marcado visualmente, com aviso
                // de confirmação na hora de salvar (ver decisions.md).
                const offHours  = whLoaded && outsideWorkingHours(workingHour, slot)
                const clickable = !occupied && !past && !onBreak && !onLeave

                return [
                  // Coluna de hora
                  <div key={`t-${slot}`}
                    className={`px-2.5 py-1.5 text-right font-mono text-[10.5px] text-ink-3 border-r border-line
                      ${isHour ? 'border-b border-b-line' : 'border-b border-b-line-2 border-dashed'}`}>
                    {isHour ? slot : ''}
                  </div>,

                  // Coluna do profissional
                  <div key={`c-${slot}`}
                    onClick={clickable ? () => setNewSlot({ slot, professional }) : undefined}
                    title={offHours && !past ? 'Fora do seu horário de trabalho' : undefined}
                    className={`relative h-16 border-line-2 overflow-visible
                      ${isHour ? 'border-b border-b-line' : 'border-b border-b-line-2'}
                      ${past || onBreak || onLeave ? 'bg-surface-2' : offHours ? 'bg-off-hours' : ''}
                      ${clickable ? 'hover:bg-brand-soft cursor-pointer transition-colors' : ''}`}>
                    {appts.map(a => {
                      const s = STATUS_STYLE[a.Status] ?? STATUS_STYLE.pendente
                      const { col = 0, totalCols = 1 } = columnMap.get(a._segKey ?? a.UUID) ?? {}
                      const w     = totalCols > 1 ? `calc(${100 / totalCols}% - 4px)` : undefined
                      const left  = totalCols > 1 ? `calc(${(col * 100) / totalCols}% + 2px)` : '3px'
                      const right = totalCols > 1 ? undefined : '3px'
                      return (
                        <button key={a._segKey ?? a.UUID}
                          onClick={e => { e.stopPropagation(); openContextMenu(e, a._original ?? a) }}
                          onContextMenu={e => openContextMenu(e, a._original ?? a)}
                          onTouchStart={e => handleLongPressStart(e, a._original ?? a)}
                          onTouchEnd={handleLongPressEnd}
                          onTouchMove={handleLongPressEnd}
                          style={{ height: apptHeight(a, 64), top: apptTop(a, slot, 64), width: w, left, right }}
                          className={`absolute rounded-md px-2 py-1.5 text-center cursor-pointer flex flex-col justify-center items-center
                            hover:opacity-80 transition-opacity overflow-hidden ${s.card}
                            ${a.Is_urgent ? 'z-20 border-2 border-warning shadow-md' : 'z-10 border'}`}>
                          {a.Is_urgent && <div className="font-mono text-[9px] uppercase tracking-widest opacity-75 mb-0.5">⚡ Urgente</div>}
                          <div className="flex items-center justify-center gap-1.5 leading-none w-full min-w-0">
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
                            <span className="font-semibold text-[11px] truncate min-w-0">{a.Client}</span>
                            {a.Recurring_appointment_id && <span title="Agendamento recorrente" className="flex-shrink-0"><Icon name="repeat" size={9} /></span>}
                          </div>
                          <div className="w-full min-w-0 mt-0.5">
                            {serviceNames(a).map((name, i) => (
                              <div key={i} className="font-mono text-[10px] opacity-75 truncate">{name}</div>
                            ))}
                          </div>
                          <div className="font-mono text-[10px] opacity-60 truncate mt-0.5">
                            {parseTime(a.Start_time)} → {parseTime(a.End_time)}
                          </div>
                        </button>
                      )
                    })}
                    {breakStart && (occupied ? (
                      <div
                        style={{ height: breakSpans * 64 - 4 }}
                        title={`Intervalo (${workingHour.Break_start.slice(0, 5)}–${workingHour.Break_end.slice(0, 5)}) — há um agendamento sobreposto`}
                        className="absolute right-0 top-[2px] z-30 w-[6px] rounded-r-md bg-ink-4 pointer-events-none"
                      />
                    ) : (
                      <div
                        style={{ height: breakSpans * 64 - 4 }}
                        className="absolute inset-x-[3px] top-[2px] z-10 rounded-md border border-line-2 bg-surface-3 flex flex-col items-center justify-center gap-0.5 pointer-events-none overflow-hidden"
                      >
                        <Icon name="clock" size={11} className="text-ink-4" />
                        <span className="font-mono text-[9.5px] text-ink-4">Intervalo</span>
                        <span className="font-mono text-[9px] text-ink-4 opacity-70">
                          {workingHour.Break_start.slice(0, 5)} – {workingHour.Break_end.slice(0, 5)}
                        </span>
                      </div>
                    ))}
                    {leaveBlock && (occupied ? (
                      <div
                        style={{ height: leaveHeight(leaveBlock, 64), top: leaveTop(leaveBlock, slot, 64) }}
                        onClick={e => { e.stopPropagation(); openLeaveMenu(e, leaveBlock) }}
                        onContextMenu={e => openLeaveMenu(e, leaveBlock)}
                        title="Folga neste horário — clique para gerenciar"
                        className="absolute left-0 z-30 w-[6px] rounded-l-md bg-danger cursor-pointer"
                      />
                    ) : (
                      <div
                        style={{ height: leaveHeight(leaveBlock, 64), top: leaveTop(leaveBlock, slot, 64) }}
                        onClick={e => { e.stopPropagation(); openLeaveMenu(e, leaveBlock) }}
                        onContextMenu={e => openLeaveMenu(e, leaveBlock)}
                        className="absolute inset-x-[3px] z-10 rounded-md border border-danger/30 bg-danger-soft flex flex-col items-center justify-center gap-0.5 overflow-hidden cursor-pointer"
                      >
                        <Icon name="x" size={11} className="text-danger" />
                        <span className="font-mono text-[9.5px] text-danger font-medium">Folga</span>
                        {leaveBlock.Reason && (
                          <span className="font-mono text-[9px] text-danger opacity-70 truncate px-1">{leaveBlock.Reason}</span>
                        )}
                      </div>
                    ))}
                  </div>,
                ]
              })}
            </div>
          </div>

          {/* Legenda */}
          <div className="flex gap-4 mt-3 flex-wrap">
            {Object.entries(STATUS_STYLE).map(([status, { dot }]) => (
              <span key={status} className="inline-flex items-center gap-1.5 font-mono text-[11px] text-ink-3">
                <i className={`w-2 h-2 rounded-full ${dot}`} />
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-ink-3">
              <i className="w-3 h-3 rounded-sm border border-line-2 bg-off-hours" />
              Fora do expediente
            </span>
          </div>
        </>
      )}
    </AppLayout>
  )
}
