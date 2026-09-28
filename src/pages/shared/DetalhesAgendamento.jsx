import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AppLayout from '@/components/layout/AppLayout'
import Sidebar from '@/components/layout/Sidebar'
import ClienteSidebar from '@/components/layout/ClienteSidebar'
import Button from '@/components/ui/Button'
import Chip from '@/components/ui/Chip'
import Avatar from '@/components/ui/Avatar'
import Modal from '@/components/ui/Modal'
import ModalFecharConta from '@/components/ui/ModalFecharConta'
import Icon from '@/components/ui/Icons'
import Input from '@/components/ui/Input'
import SearchableSelect from '@/components/ui/SearchableSelect'
import AssistantField, { assistantPayload } from '@/components/ui/AssistantField'
import { PageSpinner } from '@/components/ui/Spinner'
import ComboCard from '@/components/ui/ComboCard'
import { useToast } from '@/context/ToastContext'
import useAuthStore from '@/store/authStore'
import { usePermission } from '@/hooks/usePermission'
import api from '@/lib/api'

import { navItemsByRole } from '@/config/navItems'
import { excludeMonitorAdmins } from '@/config/monitorAdmins'
import { fetchWorkingHours, buildOutsideHoursWarning } from '@/lib/workingHours'
import { batchPayExtraMessage } from '@/lib/creditToast'

function addMinutes(timeStr, mins) {
  const [h, m] = timeStr.split(':').map(Number)
  const total = h * 60 + m + mins
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

const STATUS_LABELS = { pendente: 'Pendente', confirmado: 'Confirmado', concluido: 'Concluído', cancelado: 'Cancelado' }

const STATUS_TRANSITIONS = {
  Admin: { pendente: ['confirmado', 'cancelado'], confirmado: ['concluido', 'cancelado'], concluido: [], cancelado: [] },
  Profissional: { pendente: ['confirmado', 'cancelado'], confirmado: ['concluido', 'cancelado'], concluido: [], cancelado: [] },
  Usuario: {},
}

function formatDate(str) {
  if (!str) return '—'
  const [y, m, d] = str.split('-')
  return `${d}/${m}/${y}`
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start gap-4 py-3.5 border-b border-line-2 last:border-0">
      <div className="w-36 text-[12px] text-ink-3 font-medium shrink-0">{label}</div>
      <div className="text-[13.5px] text-ink-2">{value ?? '—'}</div>
    </div>
  )
}

// 1 linha por profissional — usada tanto pro agendamento solo (lista de 1 item) quanto
// pro atendimento combinado (Booking_group com N Appointments). Sem ação de status aqui:
// os botões "Marcar como..." no rodapé já cobrem isso, aplicando o mesmo status a todos
// os membros de uma vez (ver changeStatus).
function GroupMemberRow({ member, isCurrent, onNavigate }) {
  // Cada serviço do bloco (Appointment_services) tem seu próprio Start_time/End_time
  // desde a migration appointment_services_item_times — não junta mais tudo numa linha
  // só com o horário do bloco inteiro; blocos antigos sem horário salvo por item caem no
  // fallback do member.Start_time/End_time (horário do Appointment inteiro).
  const services = member.Services?.length > 0
    ? member.Services
    : [{ Name: member.Service, Start_time: member.Start_time, End_time: member.End_time }]
  return (
    <div
      onClick={!isCurrent ? () => onNavigate(member.UUID) : undefined}
      className={`flex items-center gap-3 py-3 border-b border-line-2 last:border-0
        ${!isCurrent ? 'cursor-pointer hover:bg-surface-2 transition-colors -mx-1 px-1 rounded-md' : ''}`}
    >
      <Avatar name={member.Professional ?? '?'} index={0} size="sm" />
      <div className="flex-1 min-w-0 space-y-0.5">
        {services.map((s, i) => (
          <div key={s.UUID ?? i} className="flex items-center gap-2 min-w-0">
            <span className="text-[13px] font-medium truncate">{s.Name ?? '—'}</span>
            <span className="font-mono text-[11px] text-ink-3 truncate shrink-0">
              {member.Professional} · {(s.Start_time ?? member.Start_time)?.slice(0, 5)} → {(s.End_time ?? member.End_time)?.slice(0, 5)}
            </span>
          </div>
        ))}
      </div>
      <Chip status={member.Status} dot>{STATUS_LABELS[member.Status] ?? member.Status}</Chip>
      {!isCurrent && (
        <Icon name="chevronRight" size={14} className="shrink-0 text-ink-3" />
      )}
    </div>
  )
}

export default function DetalhesAgendamento() {
  const { salonSlug } = useParams()
  const { id } = useParams()
  const { user } = useAuthStore()
  const { addToast } = useToast()
  const navigate = useNavigate()

  const role = user?.role ?? 'Usuario'
  const canEdit = role === 'Admin' || role === 'Profissional'
  const { can } = usePermission()

  const [item, setItem] = useState(null)
  const [history, setHistory] = useState([])
  const [combos, setCombos] = useState([])
  const [concludingPackageId, setConcludingPackageId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState({ open: false, status: '' })
  const [saving, setSaving] = useState(false)
  const [cancelingRecurring, setCancelingRecurring] = useState(false)
  const [fecharConta, setFecharConta] = useState(null)
  const [fecharPaying, setFecharPaying] = useState(false)

  const [editing, setEditing] = useState(false)
  const [editDate, setEditDate] = useState('')
  const [editItens, setEditItens] = useState([])
  // Itens que já existiam no bloco (não recém-adicionados na sessão de edição) e foram
  // explicitamente excluídos — saem do array editItens no clique, então precisam ficar
  // guardados aqui pra irem em Remove_services no PATCH (diferente de item novo removido,
  // que só é descartado, nunca existiu no backend).
  const removedExistingIdsRef = useRef([])
  const [editIsUrgent, setEditIsUrgent] = useState(false)
  const [editRecurring, setEditRecurring] = useState(false)
  const [editFrequency, setEditFrequency] = useState('semanal')
  const [editNotes, setEditNotes] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [offHoursWarning, setOffHoursWarning] = useState(null)
  const [checkingHours, setCheckingHours] = useState(false)
  // Por item: { services, loadingServices, professionalOptions, loadingProfessionals }
  const [itemMeta, setItemMeta] = useState({})
  const [assistantCandidates, setAssistantCandidates] = useState([])

  const [addingProduct, setAddingProduct] = useState(false)
  const [products, setProducts] = useState([])
  const [newProductId, setNewProductId] = useState('')
  const [newProductQty, setNewProductQty] = useState(1)
  const [savingProduct, setSavingProduct] = useState(false)
  const [removingProductId, setRemovingProductId] = useState(null)

  useEffect(() => {
    api.get(`/appointment/${id}`)
      .then(({ data }) => {
        const appt = data.data ?? data
        setItem(appt)
        if ((role === 'Profissional' || role === 'Admin') && appt.Client) {
          api.get('/appointment/my', { params: { client_name: appt.Client, limit: 6 } })
            .then(({ data: all }) => {
              const past = (all.data ?? [])
                .filter(a => a.UUID !== appt.UUID && a.Status !== 'cancelado')
                .sort((a, b) => (b.Date > a.Date ? 1 : -1))
                .slice(0, 5)
              setHistory(past)
            })
            .catch(() => {})
        }
        if ((role === 'Profissional' || role === 'Admin') && appt.Client_id) {
          api.get(`/package/client/${appt.Client_id}`)
            .then(({ data: pkgRes }) => setCombos((pkgRes.data ?? []).filter(c => c.Status === 'ativo' || c.Status === 'pendente')))
            .catch(() => setCombos([]))
        }
      })
      .catch(() => addToast('Agendamento não encontrado', 'error'))
      .finally(() => setLoading(false))
  }, [id])

  async function changeStatus() {
    // Atendimento combinado (Booking_group): todos os membros seguem o mesmo status junto
    // — confirmar/cancelar/concluir o agendamento afeta todo mundo na tela de uma vez, não
    // só o item que foi clicado pra chegar aqui.
    const targetIds = item.Group?.length > 1 ? item.Group.map(m => m.UUID) : [id]
    setSaving(true)
    try {
      await Promise.all(targetIds.map(tid => api.patch(`/appointment/${tid}`, { Status: modal.status })))
      const { data } = await api.get(`/appointment/${id}`)
      setItem(data.data ?? data)
      addToast(`Status atualizado para "${STATUS_LABELS[modal.status]}"`)
      setModal({ open: false, status: '' })
    } catch (err) {
      addToast(err.response?.data?.error ?? 'Erro ao atualizar', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setSaving(true)
    try {
      await api.delete(`/appointment/${id}`)
      addToast('Agendamento removido')
      navigate(-1)
    } catch (err) {
      addToast(err.response?.data?.error ?? 'Erro ao remover', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleCancelRecurring() {
    setCancelingRecurring(true)
    try {
      await api.delete(`/recurring-appointment/${item.Recurring_appointment_id}`)
      addToast('Recorrência cancelada')
      const { data } = await api.get(`/appointment/${id}`)
      setItem(data.data ?? data)
      setModal({ open: false, status: '' })
    } catch (err) {
      addToast(err.response?.data?.error ?? 'Erro ao cancelar recorrência', 'error')
    } finally {
      setCancelingRecurring(false)
    }
  }

  async function handleFecharConta() {
    try {
      const { data } = await api.get(`/tab/client/${item.Client_id}/account-summary`)
      if (!data.eligible) {
        addToast('Nenhuma comanda em aberto para este cliente', 'warning')
        return
      }
      setFecharConta(data)
    } catch (err) {
      addToast(err.response?.data?.error || 'Erro ao buscar comandas', 'error')
    }
  }

  async function handleConfirmFechar(tabIds, orderPayments, excludedItemIds, paymentBody) {
    setFecharPaying(true)
    try {
      const { data } = await api.post('/tab/batch-pay', {
        tab_ids: tabIds,
        Payment_date: new Date().toISOString(),
        order_payments: orderPayments,
        excluded_item_ids: excludedItemIds,
        client_id: fecharConta.client_id,
        ...paymentBody,
      })
      const extraMsg = batchPayExtraMessage(data)
      addToast(extraMsg ? `Conta fechada com sucesso. ${extraMsg}` : 'Conta fechada com sucesso')
      setFecharConta(null)
      setItem(prev => ({ ...prev, Status: 'concluido' }))
    } catch (err) {
      addToast(err.response?.data?.error ?? 'Erro ao fechar conta', 'error')
    } finally {
      setFecharPaying(false)
    }
  }

  async function handleConcludePackage(combo, note) {
    setConcludingPackageId(combo.UUID)
    try {
      await api.patch(`/package/client/${combo.UUID}/conclude`, { Note: note })
      addToast('Pacote marcado como concluído', 'success')
      const { data: pkgRes } = await api.get(`/package/client/${item.Client_id}`)
      setCombos((pkgRes.data ?? []).filter(c => c.Status === 'ativo' || c.Status === 'pendente'))
    } catch (err) {
      addToast(err.response?.data?.error || 'Erro ao concluir pacote', 'error')
    } finally {
      setConcludingPackageId(null)
    }
  }

  function openAddProduct() {
    setNewProductId('')
    setNewProductQty(1)
    setAddingProduct(true)
    if (products.length === 0) {
      api.get('/product', { params: { limit: 100 } })
        .then(({ data }) => setProducts((data.data ?? []).filter(p => p.Active)))
        .catch(() => {})
    }
  }

  async function handleAddProduct() {
    if (!newProductId) return addToast('Selecione um produto', 'warning')
    setSavingProduct(true)
    try {
      // Antes de concluído, o agendamento ainda não tem comanda (Tab só é criada
      // automaticamente ao marcar como "Concluído") — se o cliente quiser incluir um
      // produto antes disso, criamos a comanda agora mesmo, vazia, e anexamos o item nela.
      let tabId = item.Tab?.UUID
      if (!tabId) {
        const { data: newTab } = await api.post('/tab', { Value: 0, Status: 'Em aberto', Appointment: item.UUID })
        tabId = newTab.UUID
      }

      await api.post(`/tab/${tabId}/items`, {
        Product_id: newProductId,
        Quantity: newProductQty,
      })
      const product = products.find(p => p.UUID === newProductId)
      // O backend agrupa produtos repetidos por Product_id na leitura (ver
      // appointmentController.getById) — rebusca o agendamento em vez de tentar montar o
      // merge no cliente, garante que a tela sempre reflita o agrupamento real.
      const { data } = await api.get(`/appointment/${id}`)
      setItem(data.data ?? data)
      addToast(`${product?.Name ?? 'Produto'} adicionado à comanda`)
      setAddingProduct(false)
    } catch (err) {
      addToast(err.response?.data?.error ?? 'Erro ao adicionar produto', 'error')
    } finally {
      setSavingProduct(false)
    }
  }

  async function handleRemoveProduct(productItemId) {
    setRemovingProductId(productItemId)
    try {
      await api.delete(`/tab/${item.Tab.UUID}/items/${productItemId}`)
      const { data } = await api.get(`/appointment/${id}`)
      setItem(data.data ?? data)
      addToast('Produto removido da comanda')
    } catch (err) {
      addToast(err.response?.data?.error ?? 'Erro ao remover produto', 'error')
    } finally {
      setRemovingProductId(null)
    }
  }

  function openEdit() {
    setEditDate(item.Date)
    setEditIsUrgent(false)
    setEditRecurring(false)
    setEditFrequency('semanal')
    setEditNotes(item.Notes ?? '')
    const itemServices = item.Services?.length > 0
      ? item.Services
      : [{ UUID: item.Service_id, Start_time: item.Start_time, End_time: item.End_time }]
    setEditItens(itemServices.map((s, i) => ({
      // itemId = UUID da linha Appointment_services (usado em Update_services no save, pra
      // persistir a edição num item que já existia — sem ele não dá pra saber qual linha
      // remover se o usuário excluir a âncora do bloco (o item seguinte assume o lugar
      // dela; ver handleSaveEdit). isNew só fica true pra itens adicionados agora via
      // "+ Adicionar serviço" (vão em Add_services). professionalId por item — todos
      // herdam a profissional atual do bloco pra começar (é o que realmente são hoje, já
      // que Appointment_services não guarda profissional própria); trocar a de um item
      // específico faz ele sair do bloco e virar Appointment próprio ao salvar.
      itemId: s.Item_id ?? null,
      isNew: false,
      serviceId: s.UUID ?? '',
      startTime: (s.Start_time ?? item.Start_time)?.slice(0, 5) ?? '',
      endTime: (s.End_time ?? item.End_time)?.slice(0, 5) ?? '',
      professionalId: item.Professional_id ?? '',
      assistantId: s.Assistant_id ?? '',
      assistantPct: s.Assistant_commission != null ? String(s.Assistant_commission) : '',
    })))
    removedExistingIdsRef.current = []
    setItemMeta({})
    setEditing(true)
  }

  // Por item: serviços disponíveis pra profissional escolhida NAQUELE item, e profissionais
  // que atendem o serviço já escolhido naquele item (pra permitir reatribuir).
  useEffect(() => {
    if (!editing) return
    let cancelled = false
    editItens.forEach((it, i) => {
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
      if (canEdit && it.serviceId) {
        setItemMeta(prev => ({ ...prev, [i]: { ...prev[i], loadingProfessionals: true } }))
        api.get(`/service/${it.serviceId}/professionals`)
          .then(({ data }) => {
            if (cancelled) return
            setItemMeta(prev => ({ ...prev, [i]: { ...prev[i], professionalOptions: data.data ?? [], loadingProfessionals: false } }))
          })
          .catch(() => {
            if (cancelled) return
            setItemMeta(prev => ({ ...prev, [i]: { ...prev[i], professionalOptions: [], loadingProfessionals: false } }))
          })
      } else if (canEdit && !it.serviceId) {
        // Item novo (ainda sem serviço escolhido): não dá pra buscar profissionais
        // por /service/:id/professionals sem um serviceId, então usa a lista geral
        // — senão o select de profissional fica travado até o serviço ser escolhido,
        // impedindo trocar a profissional de um item recém-adicionado.
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
  }, [editing, canEdit, editItens.map(it => `${it.professionalId}|${it.serviceId}`).join(',')])

  // Candidatas a assistente: qualquer profissional (não só as que fazem o serviço).
  useEffect(() => {
    if (!editing || !canEdit) return
    Promise.all([
      api.get('/users', { params: { Role: 'Profissional', limit: 100 } }),
      api.get('/users', { params: { Role: 'Admin', limit: 100 } }),
    ])
      .then(([p, a]) => setAssistantCandidates(
        excludeMonitorAdmins([...(a.data.data ?? []), ...(p.data.data ?? [])]).map(u => ({ UUID: u.UUID, Name: u.Name }))
      ))
      .catch(() => {})
  }, [editing, canEdit])

  function handleEditAssistant(index, assistantId) {
    setEditItens(prev => prev.map((it, i) => i === index ? { ...it, assistantId } : it))
  }

  function handleEditAssistantPct(index, assistantPct) {
    setEditItens(prev => prev.map((it, i) => i === index ? { ...it, assistantPct } : it))
  }

  function handleEditService(index, serviceId) {
    setEditItens(prev => {
      const next = [...prev]
      const it = { ...next[index], serviceId }
      const svc = itemMeta[index]?.services?.find(s => s.UUID === serviceId)
      if (svc) {
        it.assistantPct = svc.Assistant_commission != null ? String(svc.Assistant_commission) : ''
      }
      if (svc?.Duration) {
        const [h, m] = svc.Duration.split(':').map(Number)
        it.endTime = addMinutes(it.startTime, h * 60 + m)
      }
      next[index] = it
      if (next[index + 1]) next[index + 1] = { ...next[index + 1], startTime: it.endTime }
      return next
    })
  }

  function handleEditProfessional(index, professionalId) {
    setEditItens(prev => {
      const next = [...prev]
      // a principal não pode ser a própria assistente
      const assistantId = next[index].assistantId === professionalId ? '' : next[index].assistantId
      next[index] = { ...next[index], professionalId, assistantId }
      return next
    })
  }

  function handleEditStartTime(index, startTime) {
    setEditItens(prev => {
      const next = [...prev]
      next[index] = { ...next[index], startTime }
      return next
    })
  }

  function handleEditEndTime(index, endTime) {
    setEditItens(prev => {
      const next = [...prev]
      next[index] = { ...next[index], endTime }
      if (next[index + 1]) next[index + 1] = { ...next[index + 1], startTime: endTime }
      return next
    })
  }

  function addEditItem() {
    setEditItens(prev => {
      const last = prev[prev.length - 1]
      return [...prev, { id: null, itemId: null, isNew: true, serviceId: '', startTime: last.endTime, endTime: addMinutes(last.endTime, 60), professionalId: last.professionalId, assistantId: '', assistantPct: '' }]
    })
  }

  function removeEditItem(index) {
    setEditItens(prev => {
      const it = prev[index]
      // Item que já existia no bloco (Appointment_services): registra pra ir em
      // Remove_services no save. Item novo (isNew) só é descartado do array, nunca
      // chegou a existir no backend.
      if (!it.isNew && it.itemId) removedExistingIdsRef.current.push(it.itemId)
      return prev.filter((_, i) => i !== index)
    })
  }

  async function handleSaveEdit(skipOffHoursCheck = false) {
    if (editItens.some(it => !it.serviceId)) return addToast('Selecione o serviço em todos os itens', 'warning')
    if (canEdit && editItens.some(it => it.assistantId && it.assistantPct === '')) return addToast('Informe a comissão da assistente', 'warning')
    if (canEdit && editItens.some(it => !it.professionalId)) return addToast('Selecione a profissional em todos os itens', 'warning')

    // Editar aqui pode mover o agendamento pra outra data E outro horário, então o
    // expediente precisa ser rebuscado pelo dia da semana NOVO (mesma lógica do
    // TransferirDrawer das agendas). Aviso, não bloqueio — ver decisions.md; falha na
    // checagem não pode impedir o salvamento.
    if (!skipOffHoursCheck) {
      setCheckingHours(true)
      try {
        const [y, m, d] = editDate.split('-').map(Number)
        const weekday = new Date(y, m - 1, d).getDay()
        const ids = [...new Set(editItens.map(it => it.professionalId).filter(Boolean))]
        const whByProf = await fetchWorkingHours(ids, weekday)
        const warning = buildOutsideHoursWarning(
          editItens.map((it, i) => ({
            professionalId: it.professionalId,
            professionalName: (itemMeta[i]?.professionalOptions ?? []).find(p => p.professional_id === it.professionalId)?.name ?? item.Professional,
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
    setSavingEdit(true)
    try {
      const [original, ...rest] = editItens
      const anchorProf = original.professionalId
      // Itens que ficam na MESMA profissional do bloco: fundidos no mesmo Appointment
      // (Add_services p/ novos, Update_services p/ já existentes) — 1 card só na Agenda,
      // 1 Tab só ao concluir. Itens com profissional DIFERENTE saem do bloco (removidos via
      // Remove_services quando já existiam) e viram Appointments próprios, ligados pelo
      // mesmo Booking_group — cobre o caso de 1 serviço do atendimento precisar de outra
      // profissional (ex: enquanto um produto age).
      const sameProf = canEdit ? rest.filter(it => it.professionalId === anchorProf) : rest
      const diffProf = canEdit ? rest.filter(it => it.professionalId !== anchorProf) : []

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

      let bookingGroup = item.Booking_group
      if ((newStandalone.length > 0 || removedStandalone.length > 0) && !bookingGroup) {
        bookingGroup = crypto.randomUUID()
      }

      await api.patch(`/appointment/${item.UUID}`, {
        Service: original.serviceId,
        Date: editDate,
        Start_time: original.startTime,
        End_time: original.endTime,
        Notes: editNotes.trim() || null,
        ...(canEdit ? { Is_urgent: editIsUrgent, Professional: anchorProf } : {}),
        ...(canEdit && editRecurring && !item.Recurring_appointment_id ? { Recurring: true, Frequency: editFrequency } : {}),
        ...(newItens.length > 0 ? {
          Add_services: newItens.map(it => ({ Service: it.serviceId, Start_time: it.startTime, End_time: it.endTime, ...(canEdit ? assistantPayload(it) : {}) }))
        } : {}),
        // o 1º item também entra: o PATCH principal atualiza serviço/horário dele, mas a assistente
        // só é gravada via Update_services (só quem edita pode mexer nela)
        ...((canEdit ? updateAll : updateItens).length > 0 ? {
          Update_services: (canEdit ? updateAll : updateItens).map(it => ({ Id: it.itemId, Service: it.serviceId, Start_time: it.startTime, End_time: it.endTime, ...(canEdit ? assistantPayload(it) : {}) }))
        } : {}),
        ...(allRemovedIds.length > 0 ? {
          Remove_services: allRemovedIds
        } : {}),
        ...(bookingGroup && bookingGroup !== item.Booking_group ? { Booking_group: bookingGroup } : {}),
      })

      for (const it of [...newStandalone, ...removedStandalone]) {
        await api.post('/appointment', {
          Client: item.Client_id,
          Professional: it.professionalId,
          Service: it.serviceId,
          Date: editDate,
          Start_time: it.startTime,
          End_time: it.endTime,
          Is_urgent: editIsUrgent,
          Booking_group: bookingGroup,
        })
      }
      const { data } = await api.get(`/appointment/${id}`)
      setItem(data.data ?? data)
      addToast('Agendamento atualizado com sucesso')
      setEditing(false)
    } catch (err) {
      if (err.response?.status === 409) {
        addToast(
          canEdit
            ? 'Já existe um agendamento nesse horário. Marque "Agendamento urgente" para sobrepor.'
            : 'Já existe um agendamento nesse horário para este profissional.',
          'error'
        )
      } else {
        addToast(err.response?.data?.error ?? 'Erro ao atualizar agendamento', 'error')
      }
    } finally {
      setSavingEdit(false)
    }
  }

  const navItems = navItemsByRole[role] ?? []
  const allowedTransitions = STATUS_TRANSITIONS[role]?.[item?.Status] ?? []
  const canReschedule = ['pendente', 'confirmado'].includes(item?.Status)

  const sidebar = role === 'Usuario'
    ? <ClienteSidebar user={user} />
    : <Sidebar navItems={navItems} footerUser={user?.name} footerRole={role}>{role}</Sidebar>


  if (loading) {
    return <AppLayout sidebar={sidebar}><PageSpinner /></AppLayout>
  }

  if (!item) {
    return (
      <AppLayout sidebar={sidebar}>
        <div className="text-center py-20 text-ink-3">Agendamento não encontrado.</div>
      </AppLayout>
    )
  }

  return (
    <AppLayout sidebar={sidebar}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-7">
        <button onClick={() => navigate(-1)} className="text-ink-3 hover:text-ink transition-colors cursor-pointer">
          <Icon name="arrowLeft" size={18} />
        </button>
        <div className="flex-1">
          <h3 className="font-display font-medium text-[24px] tracking-tight">Detalhes do agendamento</h3>
          <p className="text-[12.5px] text-ink-3 mt-0.5">#{id.slice(0, 8)}</p>
        </div>
        <Chip status={item.Status} dot>{STATUS_LABELS[item.Status] ?? item.Status}</Chip>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">
        {/* Main info */}
        <div className="bg-surface border border-line rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-line-2 flex items-center justify-between">
            <h4 className="font-medium text-[14px]">Informações</h4>
          </div>
          {editing ? (
            <div className="px-6 py-5 flex flex-col gap-4">
              <Input
                label="Data"
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
              />

              {editItens.map((it, i) => (
                <div key={i} className="flex flex-col gap-3 pb-4 border-b border-line-2 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <label className="text-[12px] text-ink-3 font-medium">
                      {editItens.length > 1 ? `Item ${i + 1}` : 'Item'}
                    </label>
                    {editItens.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeEditItem(i)}
                        className="text-ink-3 hover:text-danger transition-colors cursor-pointer"
                        title={it.isNew ? 'Cancelar item' : 'Remover serviço do agendamento'}
                      >
                        <Icon name="x" size={14} />
                      </button>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[12px] font-medium text-ink-2">Profissional</label>
                      <SearchableSelect
                        value={it.professionalId}
                        onChange={(pid) => handleEditProfessional(i, pid)}
                        disabled={itemMeta[i]?.loadingProfessionals || !(itemMeta[i]?.professionalOptions?.length > 0)}
                        options={(itemMeta[i]?.professionalOptions ?? []).map(p => ({ value: p.professional_id, label: p.name }))}
                        placeholder={itemMeta[i]?.loadingProfessionals ? 'Carregando…' : 'Selecione a profissional'}
                      />
                    </div>
                  )}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[12px] font-medium text-ink-2">Serviço</label>
                    <SearchableSelect
                      options={(itemMeta[i]?.services ?? []).map(s => ({ value: s.UUID, label: s.Name }))}
                      value={it.serviceId}
                      onChange={(sid) => handleEditService(i, sid)}
                      disabled={itemMeta[i]?.loadingServices || !(itemMeta[i]?.services?.length > 0)}
                      placeholder={itemMeta[i]?.loadingServices ? 'Carregando…' : 'Selecione o serviço'}
                    />
                  </div>
                  {canEdit && it.serviceId && (
                    <AssistantField
                      candidates={assistantCandidates}
                      excludeId={it.professionalId}
                      assistantId={it.assistantId}
                      pct={it.assistantPct}
                      onAssistant={(id) => handleEditAssistant(i, id)}
                      onPct={(v) => handleEditAssistantPct(i, v)}
                    />
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Início"
                      type="time"
                      value={it.startTime}
                      onChange={(e) => handleEditStartTime(i, e.target.value)}
                    />
                    <Input
                      label="Fim"
                      type="time"
                      value={it.endTime}
                      onChange={(e) => handleEditEndTime(i, e.target.value)}
                    />
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={addEditItem}
                className="flex items-center justify-center gap-1.5 w-full h-[38px] rounded-md border border-dashed border-line text-[13px] font-medium text-ink-3 hover:text-brand hover:border-brand/30 transition-colors cursor-pointer"
              >
                <Icon name="plus" size={14} />
                Adicionar serviço
              </button>

              {canEdit && (
                <button
                  type="button"
                  onClick={() => setEditIsUrgent(v => {
                    const next = !v
                    if (next) setEditRecurring(false)
                    return next
                  })}
                  className={`flex items-center gap-3 w-full px-4 py-3 rounded-[10px] border transition-colors cursor-pointer text-left
                    ${editIsUrgent ? 'bg-warning-soft border-warning/40' : 'bg-surface border-line hover:border-ink-3'}`}
                >
                  <div className={`w-4 h-4 rounded flex items-center justify-center border flex-shrink-0 transition-colors
                    ${editIsUrgent ? 'bg-warning border-warning' : 'border-line-2'}`}>
                    {editIsUrgent && <Icon name="check" size={10} className="text-white" />}
                  </div>
                  <div>
                    <div className={`text-[13px] font-medium ${editIsUrgent ? 'text-warning' : 'text-ink-2'}`}>Agendamento urgente</div>
                    <div className="text-[11px] text-ink-3">Permite sobrepor horários já ocupados</div>
                  </div>
                </button>
              )}

              {/* Recorrência — só pra transformar um agendamento comum em recorrente; uma
                  série já recorrente se cancela pelo botão dedicado no rodapé da página.
                  Desabilitada (não escondida) quando Urgente está marcado, para deixar
                  claro que a incompatibilidade é intencional, não um bug. */}
              {canEdit && !item.Recurring_appointment_id && (
                <div className={`flex flex-col gap-2 ${editIsUrgent ? 'opacity-50 pointer-events-none' : ''}`}>
                  <button
                    type="button"
                    onClick={() => setEditRecurring(v => !v)}
                    disabled={editIsUrgent}
                    className={`flex items-center gap-3 w-full px-4 py-3 rounded-[10px] border transition-colors cursor-pointer text-left
                      ${editRecurring ? 'bg-brand-soft border-brand/40' : 'bg-surface border-line hover:border-ink-3'}`}
                  >
                    <div className={`w-4 h-4 rounded flex items-center justify-center border flex-shrink-0 transition-colors
                      ${editRecurring ? 'bg-brand border-brand' : 'border-line-2'}`}>
                      {editRecurring && <Icon name="check" size={10} className="text-white" />}
                    </div>
                    <div>
                      <div className={`text-[13px] font-medium ${editRecurring ? 'text-brand' : 'text-ink-2'}`}>Tornar recorrente</div>
                      <div className="text-[11px] text-ink-3">
                        {editIsUrgent ? 'Indisponível com Agendamento urgente' : 'Repete automaticamente na mesma data/horário'}
                      </div>
                    </div>
                  </button>
                  {editRecurring && !editIsUrgent && (
                    <div className="flex flex-col gap-1.5 pl-1">
                      <label className="text-[12px] font-medium text-ink-2">Frequência</label>
                      <select
                        value={editFrequency}
                        onChange={e => setEditFrequency(e.target.value)}
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

              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-medium text-ink-2">Observação <span className="text-ink-4 font-normal">(opcional)</span></label>
                <textarea
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  placeholder="Ex: cliente prefere água morna, trouxe produto próprio…"
                  rows={2}
                  maxLength={1000}
                  className="w-full px-[14px] py-[10px] rounded-md border border-line bg-surface text-ink-2 font-body text-md placeholder:text-ink-4 focus:outline-none focus:border-brand transition-colors resize-none"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="md" onClick={() => setEditing(false)} className="flex-1">
                  Cancelar
                </Button>
                {/* Arrow function obrigatória — onClick={handleSaveEdit} passaria o evento
                    do clique como skipOffHoursCheck (truthy), pulando o aviso sempre. */}
                <Button variant="primary" size="md" onClick={() => handleSaveEdit()} loading={savingEdit || checkingHours} className="flex-1">
                  Salvar
                </Button>
              </div>
            </div>
          ) : (
            <div className="px-6">
              <InfoRow label="Data" value={formatDate(item.Date)} />
              <div className="py-3 border-b border-line-2">
                <div className="font-mono text-[10.5px] uppercase tracking-widest text-ink-3 mb-1">
                  Serviços
                </div>
                {(item.Group?.length > 1 ? item.Group : [item]).map(m => (
                  <GroupMemberRow
                    key={m.UUID}
                    member={m}
                    isCurrent={m.UUID === id}
                    onNavigate={(uuid) => navigate(`/${salonSlug}/agendamento/${uuid}`)}
                  />
                ))}
              </div>
              <InfoRow
                label="Produtos"
                value={
                  item.Tab?.Products?.length > 0 ? (
                    <div className="space-y-1">
                      {item.Tab.Products.map(p => (
                        <div key={p.UUID} className="flex items-center gap-2">
                          <span>{p.Quantity}x {p.Name}</span>
                          {canEdit && item.Tab.Status === 'Em aberto' && (
                            <button
                              type="button"
                              onClick={() => handleRemoveProduct(p.UUID)}
                              disabled={removingProductId === p.UUID}
                              title="Remover produto"
                              className="flex items-center justify-center w-6 h-6 -m-1 rounded text-ink-3 hover:text-danger hover:bg-danger-soft transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                            >
                              <Icon name="x" size={15} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : '—'
                }
              />
              <InfoRow label="Observação" value={item.Notes} />
              {canEdit && item.Status !== 'cancelado' && (!item.Tab?.UUID || item.Tab.Status === 'Em aberto') && (
                <div className="py-3.5">
                  <Button variant="ghost" size="sm" onClick={openAddProduct}>
                    <Icon name="plus" size={13} />Adicionar produto
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* People */}
        <div className="flex flex-col gap-4">
          {/* Client */}
          <div className="bg-surface border border-line rounded-xl p-5">
            <div className="font-mono text-[10.5px] uppercase tracking-widest text-ink-3 mb-3">Cliente</div>
            <div className="flex items-center gap-3">
              <Avatar name={item.Client ?? '?'} index={0} size="md" />
              <div>
                <div className="font-medium text-[13.5px]">{item.Client ?? '—'}</div>
              </div>
            </div>
          </div>

          {/* Professional — removido: o profissional já aparece na lista do card
              "Informações" (GroupMemberRow), sempre, agrupado ou não */}

          {/* Pacotes ativos/pendentes da cliente — visibilidade pra Admin/Profissional
              saberem se ela tem sessões disponíveis, sem precisar abrir outra tela */}
          {(role === 'Profissional' || role === 'Admin') && combos.length > 0 && (
            <div className="flex flex-col gap-3">
              {combos.map(c => (
                <ComboCard
                  key={c.UUID}
                  combo={c}
                  compact
                  onConclude={handleConcludePackage}
                  concluding={concludingPackageId === c.UUID}
                />
              ))}
            </div>
          )}

          {/* Histórico do cliente */}
          {(role === 'Profissional' || role === 'Admin') && history.length > 0 && (
            <div className="bg-surface border border-line rounded-xl p-5">
              <div className="font-mono text-[10.5px] uppercase tracking-widest text-ink-3 mb-3">
                Últimas visitas · {item.Client}
              </div>
              <div className="flex flex-col gap-0">
                {history.map((h, i) => (
                  <button
                    key={h.UUID}
                    onClick={() => navigate(`/${salonSlug}/agendamento/${h.UUID}`)}
                    className={`flex items-center justify-between py-2.5 text-left hover:bg-surface-2 -mx-2 px-2 rounded transition-colors cursor-pointer
                      ${i < history.length - 1 ? 'border-b border-line-2' : ''}`}
                  >
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium truncate">{h.Service}</div>
                      <div className="font-mono text-[11px] text-ink-3 mt-0.5">{formatDate(h.Date)}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <Chip status={h.Status} dot>{STATUS_LABELS[h.Status]}</Chip>
                      <Icon name="chevronRight" size={12} className="text-ink-4" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      {canEdit && (
        <div className="flex gap-2.5 mt-5">
          {canEdit && allowedTransitions.map(s => (
            <Button
              key={s}
              variant={s === 'cancelado' ? 'ghost' : 'primary'}
              size="sm"
              onClick={() => setModal({ open: true, status: s })}
            >
              Marcar como {STATUS_LABELS[s]}
            </Button>
          ))}
          {canEdit && can('Caixa', 'view') && item.Status === 'concluido' && (
            <Button variant="ghost" size="sm" onClick={handleFecharConta}>
              <Icon name="receipt" size={13} />Fechar comanda
            </Button>
          )}
          {/* Editar data/hora é só de Admin/Profissional — o cliente remarca cancelando e
              agendando de novo pelo /agendar, que já filtra os horários pelo expediente. */}
          {canEdit && canReschedule && !editing && (
            <Button variant="ghost" size="sm" onClick={openEdit}>
              <Icon name="edit" size={13} />Editar
            </Button>
          )}
          {canEdit && item.Status !== 'concluido' && item.Status !== 'cancelado' && (
            <Button variant="ghost" size="sm" onClick={() => setModal({ open: true, status: '__delete__' })}>
              <Icon name="trash" size={13} />Excluir
            </Button>
          )}
          {canEdit && item.Recurring_appointment_id && (
            <Button variant="ghost" size="sm" onClick={() => setModal({ open: true, status: '__cancel_recurring__' })}>
              <Icon name="repeat" size={13} />Cancelar recorrência
            </Button>
          )}
        </div>
      )}

      <Modal
        isOpen={!!offHoursWarning}
        onClose={() => setOffHoursWarning(null)}
        onConfirm={() => handleSaveEdit(true)}
        title="Fora do horário de trabalho"
        message={offHoursWarning}
        confirmLabel="Salvar mesmo assim"
      />

      {/* Confirm modal */}
      <Modal
        isOpen={modal.open && modal.status !== '__delete__' && modal.status !== '__cancel_recurring__'}
        onClose={() => setModal({ open: false, status: '' })}
        onConfirm={changeStatus}
        title={`Marcar como ${STATUS_LABELS[modal.status] ?? ''}`}
        message={modal.status === 'concluido'
          ? 'Ao concluir, uma comanda será criada automaticamente com o valor do serviço.'
          : modal.status === 'cancelado'
          ? 'Tem certeza que deseja cancelar este agendamento? Esta ação não pode ser desfeita.'
          : `Confirmar mudança de status para "${STATUS_LABELS[modal.status]}"?`}
        confirmLabel="Confirmar"
        confirmVariant={modal.status === 'cancelado' ? 'ghost' : 'primary'}
        loading={saving}
      />

      {fecharConta && (
        <ModalFecharConta
          client={fecharConta}
          paying={fecharPaying}
          onClose={() => setFecharConta(null)}
          onConfirm={handleConfirmFechar}
        />
      )}

      {addingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={() => setAddingProduct(false)} />
          <div className="relative bg-surface rounded-xl p-6 w-full max-w-sm shadow-md border border-line mx-4">
            <div className="flex items-start justify-between gap-3 mb-4">
              <h3 className="font-display font-medium text-lg tracking-tight">Adicionar produto</h3>
              <button
                onClick={() => setAddingProduct(false)}
                className="text-ink-3 hover:text-ink transition-colors mt-0.5 cursor-pointer"
              >
                <Icon name="x" size={16} />
              </button>
            </div>
            <div className="flex flex-col gap-3 mb-5">
              <SearchableSelect
                options={products.map(p => ({ value: p.UUID, label: p.Name }))}
                value={newProductId}
                onChange={setNewProductId}
                placeholder={products.length === 0 ? 'Carregando…' : 'Selecione o produto'}
                disabled={products.length === 0}
              />
              <Input
                label="Quantidade"
                type="number"
                min={1}
                value={newProductQty}
                onChange={(e) => setNewProductQty(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
            <div className="flex gap-2.5 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setAddingProduct(false)} disabled={savingProduct}>
                Cancelar
              </Button>
              <Button variant="primary" size="sm" onClick={handleAddProduct} disabled={savingProduct}>
                {savingProduct ? 'Aguarde...' : 'Adicionar'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Modal
        isOpen={modal.open && modal.status === '__delete__'}
        onClose={() => setModal({ open: false, status: '' })}
        onConfirm={handleDelete}
        title="Excluir agendamento"
        message="Esta ação é irreversível. O agendamento será removido permanentemente."
        confirmLabel="Excluir"
        loading={saving}
      />

      <Modal
        isOpen={modal.open && modal.status === '__cancel_recurring__'}
        onClose={() => setModal({ open: false, status: '' })}
        onConfirm={handleCancelRecurring}
        title="Cancelar recorrência"
        message="A série para de se repetir e as próximas ocorrências já marcadas são canceladas. Este atendimento e os já concluídos não são afetados."
        confirmLabel="Cancelar recorrência"
        loading={cancelingRecurring}
      />
    </AppLayout>
  )
}
