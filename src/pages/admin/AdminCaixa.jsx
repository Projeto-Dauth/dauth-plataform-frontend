import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate, useParams } from 'react-router-dom'
import AppLayout from '@/components/layout/AppLayout'
import Sidebar from '@/components/layout/Sidebar'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import Chip from '@/components/ui/Chip'
import Icon from '@/components/ui/Icons'
import Modal from '@/components/ui/Modal'
import ModalFecharConta from '@/components/ui/ModalFecharConta'
import CreditToggleRow from '@/components/ui/CreditToggleRow'
import PaymentMethodSplit from '@/components/ui/PaymentMethodSplit'
import { useCreditAndTroco } from '@/hooks/useCreditAndTroco'
import { usePaymentSplit } from '@/hooks/usePaymentSplit'
import { PageSpinner } from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'
import PaginationControls from '@/components/ui/PaginationControls'
import SearchableSelect from '@/components/ui/SearchableSelect'
import { useToast } from '@/context/ToastContext'
import useAuthStore from '@/store/authStore'
import api from '@/lib/api'
import { batchPayExtraMessage } from '@/lib/creditToast'
import { navItemsByRole } from '@/config/navItems'
import { usePagination } from '@/hooks/usePagination'
import { useTour } from '@/hooks/useTour'
import { adminCaixaComandasSteps } from '@/tours/adminCaixaComandas'
import MoneyValue from '@/components/ui/MoneyValue'
import { formatCurrency, formatDate, formatTime, tabStatusLabel, tabStatusVariant } from '@/lib/format'
import { STATUS_FILTERS, PERIOD_PRESETS, postAddService, tabDateStr, getPeriodRange, isFiadoTab, isPaga } from '@/lib/caixa'
import { TabPaymentInfo } from '@/components/caixa/TabPaymentInfo'
import { TabPedidosProdutos } from '@/components/caixa/TabPedidosProdutos'

const navItems = navItemsByRole['Admin']

// Corrigir o valor de um item JÁ PAGO que foi pago com mais de uma forma de pagamento:
// o backend não tem como adivinhar em qual delas entrou (ou saiu) a diferença, então
// devolve 409 com a divisão atual e quem está no caixa decide. Começa com a divisão
// original preenchida — normalmente é só ajustar uma das linhas.
function ModalDividirItem({ item, newTotal, currentPayments, saving, onClose, onConfirm }) {
  const sp = usePaymentSplit({
    total: newTotal,
    resetKey: item.UUID,
    initialPayments: currentPayments,
    trackCashTendered: false,
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-xl p-6 w-full max-w-sm shadow-md border border-line mx-4">
        <h3 className="font-display font-medium text-lg tracking-tight mb-1.5">Dividir o novo valor</h3>
        <p className="text-[13.5px] text-ink-2 mb-4 leading-relaxed">
          {(item.Item_type === 'product' ? item.Product?.Name : item.Service?.Name) ?? 'O item'} passou a valer{' '}
          <span className="font-medium text-ink"><MoneyValue>{formatCurrency(newTotal)}</MoneyValue></span>. Informe quanto entra em cada forma de pagamento usada nesta comanda — deixe 0 nas que não cobrem este item.
        </p>

        <PaymentMethodSplit sp={sp} />

        <div className="flex gap-2.5 justify-end mt-5">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button
            variant="primary"
            size="sm"
            // Perna zerada não vai pro backend: ela significa "esta forma de pagamento não
            // cobre mais nada deste item" (a divisão vem semeada com as formas usadas na
            // comanda, algumas com 0), e o schema só aceita Amount > 0.
            onClick={() => onConfirm(
              sp.payments
                .map(leg => ({ Method: leg.method, Amount: sp.legAmount(leg) }))
                .filter(p => p.Amount > 0)
            )}
            loading={saving}
            disabled={!sp.valid}
          >
            Salvar
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Aba Comandas ─────────────────────────────────────────────────────────────

function TabComandas({ user, initialAppointmentId, initialGroup }) {
  const { addToast } = useToast()

  const [tabs, setTabs] = useState([])
  const [openAccounts, setOpenAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const { restartTour } = useTour('admin_caixa_comandas', adminCaixaComandasSteps, !loading)
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [periodPreset, setPeriodPreset] = useState('todos')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [search, setSearch] = useState('')
  const [onlyMensalista, setOnlyMensalista] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [paying, setPaying] = useState(false)
  const [deleteModal, setDeleteModal] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Itens da comanda selecionada — GET /tab não traz Tab_items completo (só usa pra
  // calcular o valor pendente), então busca à parte, igual ao ModalFecharConta.
  const [selectedItems, setSelectedItems] = useState([])
  const [editingItemId, setEditingItemId] = useState(null)
  const [updatingItemId, setUpdatingItemId] = useState(null)
  // Comissão já repassada trava a edição de uma comanda Paga — mesma regra aplicada no
  // backend (tabController.checkTabEditable); aqui só decide se a UI oferece a edição.
  const [selectedCommissionPaid, setSelectedCommissionPaid] = useState(false)
  const [splitModal, setSplitModal] = useState(null)
  const [splitSaving, setSplitSaving] = useState(false)
  // Reatribuir o profissional de um item de serviço (Admin only, backend recalcula a
  // comissão pelo cascade do novo profissional) — lista carregada uma única vez.
  const [professionals, setProfessionals] = useState([])
  const [editingProfItemId, setEditingProfItemId] = useState(null)
  const [updatingProfItemId, setUpdatingProfItemId] = useState(null)
  const [assistEditor, setAssistEditor] = useState(null)   // { itemId, assistantId, pct }
  const [updatingAssistItemId, setUpdatingAssistItemId] = useState(null)

  // Adicionar serviço avulso à comanda selecionada — mesmo endpoint (POST /tab/:id/items)
  // já usado pelo ModalFecharConta, com um profissional escolhido na hora (pode ser
  // diferente do(s) já vinculado(s) à comanda). Profissional primeiro: nem toda
  // profissional atende todo serviço, então a lista de serviços só aparece filtrada por
  // quem já foi escolhido.
  const [newServiceProfId, setNewServiceProfId] = useState('')
  const [profServices, setProfServices] = useState([])
  const [loadingProfServices, setLoadingProfServices] = useState(false)
  const [newServiceId, setNewServiceId] = useState('')
  const [addingService, setAddingService] = useState(false)
  const [conflictModal, setConflictModal] = useState(null) // { serviceId, professionalId, message }
  const [confirmingOverlap, setConfirmingOverlap] = useState(false)

  useEffect(() => {
    if (!newServiceProfId) { setProfServices([]); return }
    setLoadingProfServices(true)
    api.get('/service', { params: { professional: newServiceProfId, limit: 100 } })
      .then(({ data }) => setProfServices(data.data ?? []))
      .catch(() => setProfServices([]))
      .finally(() => setLoadingProfServices(false))
  }, [newServiceProfId])

  // Fechar conta (batch pay)
  const [batchClient, setBatchClient] = useState(null) // resposta de /tab/client/:id/account-summary
  const [batchPaying, setBatchPaying] = useState(false)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [{ data }, { data: accountsData }] = await Promise.all([
        api.get('/tab', { params: { limit: 1000 } }),
        api.get('/tab/open-accounts'),
      ])
      setTabs(data.data ?? [])
      setOpenAccounts(accountsData.data ?? [])
    } catch {
      setTabs([])
      setOpenAccounts([])
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Comanda de atendimento combinado (Booking_group) não pertence a UM agendamento — não tem Appointment.UUID
  // próprio, então o link "Abrir comanda" também leva o grupo e a comanda é achada por ele.
  const isTargetTab = t => t.Appointment?.UUID === initialAppointmentId
    || (!!initialGroup && t.Appointment?.Booking_group === initialGroup)

  useEffect(() => {
    if (tabs.length === 0) return
    if (initialAppointmentId) {
      const match = tabs.find(isTargetTab)
      if (match) { setSelectedId(match.UUID); return }
    }
    if (!selectedId) setSelectedId(tabs[0].UUID)
  }, [tabs])

  const filteredByStatus = statusFilter === 'Todos'
    ? tabs
    : tabs.filter((t) => {
        if (statusFilter === 'Paga') return t.Status === 'Paga' || t.Status === 'Pago'
        return t.Status === statusFilter
      })

  const { from: periodFrom, to: periodTo } = periodPreset === 'personalizado'
    ? { from: customFrom || null, to: customTo || null }
    : getPeriodRange(periodPreset)

  const filteredByPeriod = (!periodFrom && !periodTo)
    ? filteredByStatus
    : filteredByStatus.filter((t) => {
        const d = tabDateStr(t)
        if (!d) return false
        if (periodFrom && d < periodFrom) return false
        if (periodTo && d > periodTo) return false
        return true
      })

  const filteredByMensalista = onlyMensalista
    ? filteredByPeriod.filter(isFiadoTab)
    : filteredByPeriod

  const search_ = search.trim().toLowerCase()
  const filteredBase = search_
    ? filteredByMensalista.filter((t) => (t.Appointment?.Client ?? t.Package?.Client ?? '').toLowerCase().includes(search_))
    : filteredByMensalista

  const filtered = initialAppointmentId
    ? [...filteredBase].sort((a, b) => {
        const aMatch = isTargetTab(a) ? -1 : 0
        const bMatch = isTargetTab(b) ? -1 : 0
        return aMatch - bMatch
      })
    : filteredBase

  const { pageItems: pagedTabs, page, setPage, totalPages } = usePagination(filtered, 20)

  useEffect(() => { setPage(1) }, [statusFilter, periodFrom, periodTo, search, onlyMensalista])

  const selected = tabs.find((t) => t.UUID === selectedId)

  const emAberto = tabs.filter((t) => t.Status === 'Em aberto').length
  const totalAberto = tabs.filter((t) => t.Status === 'Em aberto').reduce((s, t) => s + t.Value, 0)

  const cr = useCreditAndTroco({
    clientId: selected?.Appointment?.ClientId,
    total: selected?.Value ?? 0,
    resetKey: selectedId,
  })
  const sp = usePaymentSplit({ total: cr.remainingAfterCredit, resetKey: selectedId })

  useEffect(() => {
    if (!selectedId) { setSelectedItems([]); setSelectedCommissionPaid(false); return }
    api.get(`/tab/${selectedId}`)
      .then(({ data }) => {
        setSelectedItems(data.Tab_items ?? [])
        setSelectedCommissionPaid(!!data.CommissionPaid)
      })
      .catch(() => { setSelectedItems([]); setSelectedCommissionPaid(false) })
  }, [selectedId])

  // Admin pode editar itens/valores de uma comanda já Paga enquanto a comissão de nenhum
  // item dela tiver sido repassada — mesma regra do backend (checkTabEditable), só decide
  // se a UI oferece a edição; o endpoint continua sendo a fonte real da trava.
  const canEditPaidTab = user?.role === 'Admin' && selected?.Status === 'Paga' && !selectedCommissionPaid
  // Trocar o profissional de um item é sempre Admin-only (mesmo em comanda Em aberto) —
  // ver tabController.updateItem.
  const canEditProfessional = user?.role === 'Admin' && (selected?.Status === 'Em aberto' || canEditPaidTab)

  useEffect(() => {
    if (user?.role !== 'Admin') return
    Promise.all([
      api.get('/users', { params: { Role: 'Profissional', limit: 100 } }),
      api.get('/users', { params: { Role: 'Admin', limit: 100 } }),
    ])
      .then(([a, b]) => setProfessionals([...(a.data.data ?? []), ...(b.data.data ?? [])]))
      .catch(() => setProfessionals([]))
  }, [user?.role])

  // Adiciona um serviço avulso à comanda selecionada, com um profissional escolhido na
  // hora — mesma cascata de preço/comissão do backend, sem precisar de novo agendamento.
  function applyAddedService(newItem, serviceId, professionalId) {
    const service = profServices.find(s => s.UUID === serviceId)
    const professional = professionals.find(p => p.UUID === professionalId)
    const enrichedItem = {
      ...newItem,
      Service: service ? { Name: service.Name } : null,
      Professional: professional ? { Name: professional.Name } : null,
    }
    setSelectedItems(prev => [...prev, enrichedItem])
    setTabs(prev => prev.map(t => t.UUID === selected.UUID
      ? { ...t, Value: t.Value + enrichedItem.Unit_price * enrichedItem.Quantity }
      : t
    ))
    addToast(`${service?.Name ?? 'Serviço'} adicionado à comanda`, 'success')
  }

  async function handleAddService() {
    if (!selected || !newServiceId || !newServiceProfId) return
    setAddingService(true)
    try {
      const { data: newItem } = await postAddService(selected.UUID, newServiceId, newServiceProfId)
      applyAddedService(newItem, newServiceId, newServiceProfId)
      setNewServiceId('')
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.conflict) {
        setConflictModal({ serviceId: newServiceId, professionalId: newServiceProfId, message: err.response.data.error })
      } else {
        addToast(err.response?.data?.error || 'Erro ao adicionar serviço', 'error')
      }
    } finally {
      setAddingService(false)
    }
  }

  async function handleConfirmOverlap() {
    if (!conflictModal || !selected) return
    setConfirmingOverlap(true)
    try {
      const { data: newItem } = await postAddService(selected.UUID, conflictModal.serviceId, conflictModal.professionalId, true)
      applyAddedService(newItem, conflictModal.serviceId, conflictModal.professionalId)
      setNewServiceId('')
      setConflictModal(null)
    } catch (err) {
      addToast(err.response?.data?.error || 'Erro ao adicionar serviço', 'error')
    } finally {
      setConfirmingOverlap(false)
    }
  }

  // Edita o Unit_price de um item da comanda selecionada — mesmo padrão do
  // ModalFecharConta.jsx (PATCH /tab/:id/items/:itemId recalcula Tab.Value via trigger no
  // banco; local só espelha a mesma soma pra não precisar rebuscar tudo).
  // Envia o novo preço do item. `payments` só vai junto quando o item já está pago e foi
  // pago com mais de uma forma — nesse caso é ela que diz onde a diferença entra/sai (o
  // backend reescreve as Transactions do item a partir disso).
  async function patchItemPrice(item, newPrice, payments) {
    const body = { Unit_price: newPrice }
    if (payments) body.Payments = payments
    const { data: updatedItem } = await api.patch(`/tab/${selected.UUID}/items/${item.UUID}`, body)

    const nextItems = selectedItems.map(i =>
      i.UUID === updatedItem.UUID ? { ...i, Unit_price: updatedItem.Unit_price, Quantity: updatedItem.Quantity } : i
    )
    setSelectedItems(nextItems)
    // Comanda paga mostra o total cheio; em aberto, só o que resta a cobrar (mesma regra
    // do withPendingValue no backend).
    const paidTab = isPaga(selected.Status)
    setTabs(prev => prev.map(t => t.UUID === selected.UUID
      ? { ...t, Value: nextItems.filter(i => paidTab || i.Status !== 'pago').reduce((s, i) => s + i.Unit_price * i.Quantity, 0) }
      : t
    ))
  }

  async function handleUpdateItemPrice(item, rawValue) {
    setEditingItemId(null)
    const newPrice = parseFloat(String(rawValue).replace(',', '.'))
    if (!Number.isFinite(newPrice) || newPrice < 0 || newPrice === item.Unit_price) return
    setUpdatingItemId(item.UUID)
    try {
      await patchItemPrice(item, newPrice)
    } catch (err) {
      const currentPayments = err.response?.data?.current_payments
      if (err.response?.status === 409 && currentPayments) {
        setSplitModal({ item, newPrice, newTotal: Number((newPrice * item.Quantity).toFixed(2)), currentPayments })
      } else {
        addToast(err.response?.data?.error || 'Erro ao atualizar valor do item', 'error')
      }
    } finally {
      setUpdatingItemId(null)
    }
  }

  async function handleConfirmSplit(payments) {
    if (!splitModal) return
    setSplitSaving(true)
    try {
      await patchItemPrice(splitModal.item, splitModal.newPrice, payments)
      addToast('Valor e pagamento atualizados', 'success')
      setSplitModal(null)
    } catch (err) {
      addToast(err.response?.data?.error || 'Erro ao atualizar valor do item', 'error')
    } finally {
      setSplitSaving(false)
    }
  }

  function renderItemPrice(item) {
    if (editingItemId === item.UUID) {
      return (
        <input
          autoFocus
          type="text"
          inputMode="decimal"
          defaultValue={item.Unit_price}
          onInput={e => {
            const cleaned = e.target.value.replace(/[^0-9.,]/g, '')
            if (cleaned !== e.target.value) e.target.value = cleaned
          }}
          onBlur={e => handleUpdateItemPrice(item, e.target.value.replace(',', '.'))}
          onKeyDown={e => {
            if (e.key === 'Enter') e.target.blur()
            if (e.key === 'Escape') { e.target.value = item.Unit_price; e.target.blur() }
          }}
          className="w-20 h-6 px-1.5 rounded border border-brand bg-surface text-ink text-[12.5px] font-mono text-right focus:outline-none shrink-0"
        />
      )
    }
    const isUpdating = updatingItemId === item.UUID
    return (
      <button
        type="button"
        onClick={() => setEditingItemId(item.UUID)}
        disabled={isUpdating}
        title="Editar valor do item"
        className="font-mono shrink-0 hover:text-brand hover:underline decoration-dotted underline-offset-2 cursor-pointer disabled:opacity-50 disabled:cursor-wait transition-colors"
      >
        <MoneyValue>{formatCurrency(item.Unit_price * item.Quantity)}</MoneyValue>
      </button>
    )
  }

  // Troca o profissional de um item de serviço — o backend recalcula Commission_percent
  // pelo cascade do novo profissional (override dele para o serviço, senão o padrão do
  // Service); nunca mantém o percentual resolvido pro profissional antigo.
  async function handleUpdateItemProfessional(item, newProfessionalId) {
    setEditingProfItemId(null)
    if (!newProfessionalId || newProfessionalId === item.Professional_id) return
    setUpdatingProfItemId(item.UUID)
    try {
      const { data: updatedItem } = await api.patch(`/tab/${selected.UUID}/items/${item.UUID}`, { Professional_id: newProfessionalId })
      const prof = professionals.find(p => p.UUID === newProfessionalId)
      setSelectedItems(prev => prev.map(i =>
        i.UUID === updatedItem.UUID
          ? { ...i, Professional_id: updatedItem.Professional_id, Professional: prof ? { Name: prof.Name } : i.Professional }
          : i
      ))
    } catch (err) {
      addToast(err.response?.data?.error || 'Erro ao trocar o profissional do item', 'error')
    } finally {
      setUpdatingProfItemId(null)
    }
  }

  function assistantLabel(item) {
    return `Assistente: ${item.Assistant.Name} (${item.Assistant_commission_percent ?? 0}%)`
  }

  // Abre o editor da assistente (linha inteira embaixo do item). O percentual já vem preenchido com o do
  // item ou, se ainda não há assistente, com a sugestão do serviço.
  function openAssistEditor(item) {
    setAssistEditor({
      itemId: item.UUID,
      assistantId: item.Assistant_id ?? '',
      pct: item.Assistant_commission_percent != null
        ? String(item.Assistant_commission_percent)
        : (item.Service?.Assistant_commission != null ? String(item.Service.Assistant_commission) : ''),
    })
  }

  // Salva assistente + percentual numa requisição só (Admin-only no backend; 409 depois de qualquer
  // repasse de comissão da comanda). "Sem assistente" remove.
  async function saveAssistEditor(item) {
    const { assistantId, pct } = assistEditor
    const value = Number(pct)
    if (assistantId && (pct === '' || Number.isNaN(value) || value < 0 || value > 100)) {
      addToast('Informe a comissão da assistente (entre 0 e 100%)', 'warning')
      return
    }
    const unchanged = (assistantId || null) === (item.Assistant_id ?? null)
      && (!assistantId || value === Number(item.Assistant_commission_percent ?? 0))
    if (unchanged) { setAssistEditor(null); return }

    setUpdatingAssistItemId(item.UUID)
    try {
      const body = assistantId ? { Assistant_id: assistantId, Assistant_commission_percent: value } : { Assistant_id: null }
      const { data: updated } = await api.patch(`/tab/${selected.UUID}/items/${item.UUID}`, body)
      const assistant = professionals.find(p => p.UUID === updated.Assistant_id)
      setSelectedItems(prev => prev.map(i =>
        i.UUID === updated.UUID
          ? {
              ...i,
              Assistant_id: updated.Assistant_id,
              Assistant_commission_percent: updated.Assistant_commission_percent,
              Assistant: assistant ? { Name: assistant.Name } : null,
            }
          : i
      ))
      setAssistEditor(null)
    } catch (err) {
      addToast(err.response?.data?.error || 'Erro ao salvar a assistente', 'error')
    } finally {
      setUpdatingAssistItemId(null)
    }
  }

  // Linha de resumo do item: "Assistente: Nome (25%)" ou "+ Assistente" — clicar abre o editor.
  function renderItemAssistant(item) {
    if (item.Item_type !== 'service') return null
    if (!canEditProfessional) {
      return item.Assistant?.Name ? <div className="text-[11px] text-ink-3 truncate">{assistantLabel(item)}</div> : null
    }
    return (
      <button
        type="button"
        onClick={() => openAssistEditor(item)}
        title="Definir ou alterar a assistente e a comissão dela"
        className="block text-[11px] text-ink-3 hover:text-brand hover:underline decoration-dotted underline-offset-2 cursor-pointer transition-colors truncate max-w-full text-left"
      >
        {item.Assistant?.Name ? assistantLabel(item) : '+ Assistente'}
      </button>
    )
  }

  function renderAssistEditor(item) {
    if (assistEditor?.itemId !== item.UUID) return null
    const busy = updatingAssistItemId === item.UUID
    return (
      <div className="mt-2 mb-1 rounded-md border border-line bg-surface-2 p-3 flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-ink-2">Assistente</label>
          <SearchableSelect
            value={assistEditor.assistantId}
            onChange={id => setAssistEditor(e => ({ ...e, assistantId: id }))}
            options={[
              { value: '', label: 'Sem assistente' },
              ...professionals.filter(p => p.UUID !== item.Professional_id).map(p => ({ value: p.UUID, label: p.Name })),
            ]}
            placeholder="Sem assistente"
          />
        </div>
        {assistEditor.assistantId && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-ink-2">Comissão da assistente (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={assistEditor.pct}
              placeholder="0–100"
              onChange={e => setAssistEditor(ed => ({ ...ed, pct: e.target.value }))}
              className={`w-full h-[38px] px-3 rounded-md border bg-surface text-ink-2 text-[13px] focus:outline-none focus:border-brand transition-colors ${assistEditor.pct === '' ? 'border-danger' : 'border-line'}`}
            />
          </div>
        )}
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={() => setAssistEditor(null)} disabled={busy}>Cancelar</Button>
          <Button type="button" size="sm" onClick={() => saveAssistEditor(item)} loading={busy}>Salvar</Button>
        </div>
      </div>
    )
  }

  function renderItemProfessional(item) {
    if (item.Item_type !== 'service') return null
    if (editingProfItemId === item.UUID) {
      return (
        <select
          autoFocus
          defaultValue={item.Professional_id ?? ''}
          onChange={e => handleUpdateItemProfessional(item, e.target.value)}
          onBlur={() => setEditingProfItemId(null)}
          className="h-6 px-1 rounded border border-brand bg-surface text-ink text-[11.5px] focus:outline-none shrink-0 max-w-[140px]"
        >
          <option value="" disabled>Selecione</option>
          {professionals.map(p => <option key={p.UUID} value={p.UUID}>{p.Name}</option>)}
        </select>
      )
    }
    const isUpdating = updatingProfItemId === item.UUID
    return (
      <button
        type="button"
        onClick={() => setEditingProfItemId(item.UUID)}
        disabled={isUpdating}
        title="Trocar profissional do item"
        className="text-[11px] text-ink-3 hover:text-brand hover:underline decoration-dotted underline-offset-2 cursor-pointer disabled:opacity-50 disabled:cursor-wait transition-colors truncate max-w-[140px] text-left"
      >
        {item.Professional?.Name ?? 'Sem profissional'}
      </button>
    )
  }

  async function handlePagar() {
    if (!selected) return
    setPaying(true)
    try {
      // Mesma RPC do "Fechar conta" (batch_pay_tabs), com um único tab_id: ela gera 1
      // Transaction por Tab_item, com o profissional e a comissão de cada um, e marca os
      // itens como pagos. O caminho antigo (POST /transaction + PATCH Status) foi escrito
      // quando 1 comanda = 1 serviço — numa comanda multi-item ele fechava a comanda sem
      // tocar nos Tab_items, perdendo a comissão dos demais profissionais.
      const clientId = selected.Appointment?.ClientId
      const { data } = await api.post('/tab/batch-pay', {
        tab_ids: [selected.UUID],
        Payment_date: new Date().toISOString(),
        ...(clientId ? { client_id: clientId } : {}),
        ...sp.toRequestBody(),
        ...cr.extra,
      })
      const extraMsg = batchPayExtraMessage(data)
      addToast(extraMsg ? `Pagamento registrado. ${extraMsg}` : 'Pagamento registrado', 'success')
      load(true)
    } catch (err) {
      addToast(err.response?.data?.error || 'Erro ao registrar pagamento', 'error')
    } finally {
      setPaying(false)
    }
  }

  async function handleDeleteTab() {
    if (!deleteModal) return
    setDeleting(true)
    try {
      await api.delete(`/tab/${deleteModal.UUID}`)
      addToast('Comanda excluída', 'success')
      setDeleteModal(null)
      if (selectedId === deleteModal.UUID) setSelectedId(null)
      load(true)
    } catch (err) {
      addToast(err.response?.data?.error || 'Erro ao excluir comanda', 'error')
    } finally {
      setDeleting(false)
    }
  }

  async function openBatchModal(c) {
    try {
      const { data } = await api.get(`/tab/client/${c.client_id}/account-summary`)
      setBatchClient(data)
    } catch (err) {
      addToast(err.response?.data?.error || 'Erro ao carregar conta do cliente', 'error')
    }
  }

  async function handleFecharConta(tabIds, orderPayments, excludedItemIds, paymentBody) {
    if (!batchClient) return
    setBatchPaying(true)
    try {
      const { data } = await api.post('/tab/batch-pay', {
        tab_ids: tabIds,
        Payment_date: new Date().toISOString(),
        order_payments: orderPayments,
        excluded_item_ids: excludedItemIds,
        client_id: batchClient.client_id,
        ...paymentBody,
      })
      const extraMsg = batchPayExtraMessage(data)
      addToast(extraMsg ? `Conta de ${batchClient.client_name} fechada com sucesso. ${extraMsg}` : `Conta de ${batchClient.client_name} fechada com sucesso`, 'success')
      setBatchClient(null)
      load(true)
    } catch (err) {
      addToast(err.response?.data?.error || 'Erro ao fechar conta', 'error')
    } finally {
      setBatchPaying(false)
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-5 md:mb-6">
        <p className="text-[12px] md:text-[13px] text-ink-3">
          {emAberto} em aberto · <MoneyValue>{formatCurrency(totalAberto)}</MoneyValue> a receber
        </p>
        <button onClick={restartTour} className="inline-flex items-center gap-1 text-[11px] text-ink-4 hover:text-brand transition-colors" title="Repetir tour guiado">
          <Icon name="helpCircle" size={12} />
          Ver tour
        </button>
      </div>

      {/* Contas a fechar */}
      {openAccounts.length > 0 && (
        <div className="mb-5 space-y-2">
          <p className="font-mono text-[10.5px] uppercase tracking-widest text-ink-3 mb-2">
            {openAccounts.length === 1 ? 'Conta em aberto' : 'Contas em aberto'}
          </p>
          {openAccounts.map((c, idx) => (
            <div key={c.client_id} className="flex items-center justify-between gap-3 bg-surface border border-line rounded-[12px] px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar name={c.client_name} index={idx} size="sm" />
                <div className="min-w-0">
                  <div className="text-[13px] font-medium truncate">{c.client_name}</div>
                  <div className="font-mono text-[11px] text-ink-3">
                    {c.tab_count + c.order_count} ite{c.tab_count + c.order_count !== 1 ? 'ns' : 'm'} · <MoneyValue>{formatCurrency(c.total)}</MoneyValue>
                  </div>
                </div>
              </div>
              <button
                onClick={() => openBatchModal(c)}
                className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[8px] text-[12.5px] font-medium bg-brand text-white hover:bg-brand/90 transition-colors cursor-pointer">
                <Icon name="cash" size={13} />
                Fechar conta
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Filtro de período */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex items-center gap-1 p-1 bg-surface-2 border border-line rounded-xl shrink-0 overflow-x-auto">
          {PERIOD_PRESETS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriodPreset(p.key)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors cursor-pointer ${
                periodPreset === p.key ? 'bg-surface text-ink shadow-sm border border-line' : 'text-ink-3 hover:text-ink'
              }`}>
              {p.label}
            </button>
          ))}
        </div>
        {periodPreset === 'personalizado' && (
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

      {/* Busca + Filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 mb-5">
        <div className="relative flex-1 sm:max-w-[280px]">
          <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente..."
            className="w-full h-[36px] pl-8 pr-3 rounded-full border border-line bg-surface text-ink-2 text-[13px] placeholder:text-ink-4 focus:outline-none focus:border-brand transition-colors"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTERS.map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`inline-flex items-center px-2.5 py-[4px] rounded-full text-xs font-medium border cursor-pointer transition-colors
                ${statusFilter === s ? 'bg-ink text-bg border-ink' : 'bg-surface-2 text-ink-2 border-line hover:border-ink-3'}`}>
              {s}
            </button>
          ))}
          <button onClick={() => setOnlyMensalista((v) => !v)}
            className={`inline-flex items-center px-2.5 py-[4px] rounded-full text-xs font-medium border cursor-pointer transition-colors
              ${onlyMensalista ? 'bg-warning text-white border-warning' : 'bg-surface-2 text-ink-2 border-line hover:border-ink-3'}`}>
            Mensalistas
          </button>
        </div>
      </div>

      {/* Modal fechar conta */}
      {batchClient && (
        <ModalFecharConta
          client={batchClient}
          paying={batchPaying}
          onClose={() => setBatchClient(null)}
          onConfirm={handleFecharConta}
        />
      )}

      {splitModal && (
        <ModalDividirItem
          item={splitModal.item}
          newTotal={splitModal.newTotal}
          currentPayments={splitModal.currentPayments}
          saving={splitSaving}
          onClose={() => setSplitModal(null)}
          onConfirm={handleConfirmSplit}
        />
      )}

      <Modal
        isOpen={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        onConfirm={handleDeleteTab}
        title="Excluir comanda"
        message={`Excluir a comanda de "${deleteModal?.Appointment?.Client ?? deleteModal?.Package?.Client ?? 'cliente'}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        loading={deleting}
      />

      <Modal
        isOpen={!!conflictModal}
        onClose={() => setConflictModal(null)}
        onConfirm={handleConfirmOverlap}
        title="Conflito de horário"
        message={`${conflictModal?.message ?? ''} Deseja lançar mesmo assim?`}
        confirmLabel="Lançar mesmo assim"
        loading={confirmingOverlap}
      />

      {loading ? <PageSpinner /> : tabs.length === 0 ? (
        <EmptyState icon="receipt" title="Nenhuma comanda" description="Nenhuma comanda encontrada." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-4">

          {/* Lista */}
          <div data-tour="comanda-lista" className={`bg-surface border border-line rounded-[14px] overflow-hidden h-fit ${selectedId ? 'hidden lg:block' : ''}`}>
            <div className="px-5 py-3.5 border-b border-line flex justify-between items-center">
              <div className="font-display font-medium text-[16px]">Comandas</div>
              <span className="font-mono text-[11px] text-ink-3">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
            </div>
            {filtered.length === 0 ? (
              <div className="px-5 py-8 text-center text-ink-3 text-[13px]">Nenhuma comanda neste filtro</div>
            ) : pagedTabs.map((t, idx) => (
              <button key={t.UUID} onClick={() => setSelectedId(t.UUID)}
                className={`w-full flex items-center gap-3 px-4 md:px-5 py-3.5 md:py-4 border-b border-line-2 last:border-0 cursor-pointer transition-colors text-left
                  ${t.UUID === selectedId ? 'bg-brand-soft' : 'hover:bg-surface-2'}`}>
                <Avatar name={t.Appointment?.Client ?? t.Package?.Client ?? '?'} index={idx} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <div className="text-[13px] md:text-[13.5px] font-medium truncate">{t.Appointment?.Client ?? t.Package?.Client ?? 'Comanda avulsa'}</div>
                    {t.Appointment?.Recurring_appointment_id && (
                      <span title="Agendamento recorrente" className="flex-shrink-0 text-ink-4">
                        <Icon name="repeat" size={11} />
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-[11px] text-ink-3 mt-0.5 truncate">
                    {t.Appointment
                      ? t.Appointment.Service
                        ? `${t.Appointment.Service} · ${formatDate(t.Appointment.Date)} · ${formatTime(t.Appointment.Start_time)}`
                        : `Atendimento combinado · ${formatDate(t.Appointment.Date)} · ${formatTime(t.Appointment.Start_time)}`
                      : t.Package
                        ? `Pacote: ${t.Package.Name ?? '—'}`
                        : `Criada em ${formatDate(t.Created_at)}`}
                  </div>
                </div>
                <div className="font-mono text-[12px] md:text-[13px] font-medium shrink-0">
                  <MoneyValue>{formatCurrency(t.Value)}</MoneyValue>
                </div>
                {isFiadoTab(t)
                  ? <Chip variant="warning" className="shrink-0">Mensalista</Chip>
                  : <Chip variant={tabStatusVariant(t.Status)} className="shrink-0">{tabStatusLabel(t.Status)}</Chip>}
              </button>
            ))}
            {filtered.length > 0 && (
              <div className="px-4 md:px-5 py-3">
                <PaginationControls page={page} totalPages={totalPages} onChange={setPage} />
              </div>
            )}
          </div>

          {/* Painel de pagamento — sticky: acompanha o scroll normalmente até a lista
              alcançá-lo, aí trava no topo (top-6) enquanto o resto da lista continua
              passando por baixo. Wrapper com lg:h-full dá "espaço de sobra" na célula do
              grid pra isso funcionar — sem ele o sticky não gruda (a célula fica exatamente
              do tamanho do painel, sem folga pra ele se mover). */}
          {selected && (
          <div className="lg:h-full">
            <div data-tour="comanda-painel" className="bg-surface border border-line rounded-[14px] h-fit lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] flex flex-col">
              <button onClick={() => setSelectedId(null)} className="lg:hidden w-full flex items-center gap-1.5 px-6 pt-4 text-[12px] text-ink-3 hover:text-brand transition-colors cursor-pointer shrink-0">
                <Icon name="arrowLeft" size={14} />
                Voltar para a lista
              </button>
              <div className="px-6 py-5 border-b border-line shrink-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10.5px] uppercase tracking-widest text-ink-3">Comanda selecionada</span>
                  {selected.Status === 'Em aberto' && (
                    <button
                      type="button"
                      onClick={() => setDeleteModal(selected)}
                      title="Excluir comanda"
                      className="text-ink-4 hover:text-danger transition-colors cursor-pointer shrink-0"
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  )}
                </div>
                <h4 className="font-display font-medium text-[19px] tracking-tight mt-1.5">
                  {selected.Appointment?.Client ?? selected.Package?.Client ?? 'Comanda avulsa'}
                </h4>
                {selected.Package && !selected.Appointment && (
                  <div className="font-mono text-[11px] text-ink-3 mt-1">Pacote: {selected.Package.Name ?? '—'}</div>
                )}
                {selected.Appointment && (
                  <div className="font-mono text-[11.5px] text-ink-3 mt-1">
                    {selected.Appointment.Service
                      ? `${selected.Appointment.Service} · ${formatDate(selected.Appointment.Date)} · ${formatTime(selected.Appointment.Start_time)} · ${selected.Appointment.Professional}`
                      : `Atendimento combinado · ${formatDate(selected.Appointment.Date)} · ${formatTime(selected.Appointment.Start_time)}`}
                  </div>
                )}
              </div>

              <div className="px-6 py-5 overflow-y-auto flex-1 min-h-0 scrollbar-hidden">
                {selectedItems.length > 0 && (
                  <div className="pb-3.5 border-b border-dashed border-line-2 mb-1">
                    <div className="font-mono text-[10.5px] uppercase tracking-widest text-ink-3 mb-2">Itens</div>
                    <div className="space-y-1.5">
                      {selectedItems.map(item => (
                        <div key={item.UUID} className="text-[13px]">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <span className="text-ink-2 truncate flex items-center gap-1.5">
                              {(item.Item_type === 'product' ? item.Product?.Name : item.Service?.Name) ?? '—'}
                              {item.Quantity > 1 ? ` ×${item.Quantity}` : ''}
                              {item.Via_package && (
                                <span className="inline-flex items-center px-1.5 py-[1px] rounded-full text-[10px] font-medium bg-brand-soft text-brand shrink-0">
                                  Pago no pacote
                                </span>
                              )}
                            </span>
                            {canEditProfessional && renderItemProfessional(item)}
                            {renderItemAssistant(item)}
                          </div>
                          {item.Via_package
                            ? <span className="font-mono text-ink-4 shrink-0"><MoneyValue>{formatCurrency(item.Unit_price * item.Quantity)}</MoneyValue></span>
                            : (canEditPaidTab || (selected.Status === 'Em aberto' && item.Status !== 'pago'))
                              ? renderItemPrice(item)
                              : <span className="font-mono shrink-0"><MoneyValue>{formatCurrency(item.Unit_price * item.Quantity)}</MoneyValue></span>}
                        </div>
                        {renderAssistEditor(item)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selected.Status === 'Em aberto' && (
                  <div className="pb-3.5 border-b border-dashed border-line-2 mb-1">
                    <div className="font-mono text-[10.5px] uppercase tracking-widest text-ink-3 mb-2">Adicionar serviço</div>
                    <div className="flex flex-col gap-1.5">
                      <select
                        value={newServiceProfId}
                        onChange={e => { setNewServiceProfId(e.target.value); setNewServiceId('') }}
                        className="h-8 px-2 rounded-md border border-line bg-surface text-ink-2 text-[12px] focus:outline-none focus:border-brand transition-colors"
                      >
                        <option value="">Profissional...</option>
                        {professionals.map(p => <option key={p.UUID} value={p.UUID}>{p.Name}</option>)}
                      </select>
                      <div className="flex items-center gap-2">
                        <select
                          value={newServiceId}
                          onChange={e => setNewServiceId(e.target.value)}
                          disabled={!newServiceProfId || loadingProfServices}
                          className="h-8 flex-1 min-w-0 px-2 rounded-md border border-line bg-surface text-ink-2 text-[12px] focus:outline-none focus:border-brand transition-colors disabled:opacity-50"
                        >
                          <option value="">{loadingProfServices ? 'Carregando...' : 'Serviço...'}</option>
                          {profServices.map(s => <option key={s.UUID} value={s.UUID}>{s.Name}</option>)}
                        </select>
                        <button
                          type="button"
                          onClick={handleAddService}
                          disabled={!newServiceId || !newServiceProfId || addingService}
                          title="Adicionar à comanda"
                          className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-brand text-white hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer">
                          <Icon name="plus" size={14} />
                        </button>
                      </div>
                      {newServiceProfId && !loadingProfServices && profServices.length === 0 && (
                        <div className="text-[11px] text-ink-4">Essa profissional não atende nenhum serviço.</div>
                      )}
                    </div>
                  </div>
                )}

                {selected.Status === 'Em aberto' && cr.parsedCreditAmount > 0 && (
                  <div className="flex justify-between items-center py-2 text-[13px]">
                    <span className="text-ink-3">Desconto crédito</span>
                    <span className="font-mono font-medium text-danger">-<MoneyValue>{formatCurrency(cr.parsedCreditAmount)}</MoneyValue></span>
                  </div>
                )}

                <div className="flex justify-between items-center py-3.5 border-b border-dashed border-line-2">
                  <span className="font-mono text-[11px] uppercase tracking-widest text-ink-3">Valor</span>
                  <span className="font-display text-[22px] font-medium"><MoneyValue>{formatCurrency(selected.Status === 'Em aberto' ? cr.remainingAfterCredit : selected.Value)}</MoneyValue></span>
                </div>

                {selected.Status === 'Em aberto' && selected.Appointment?.ClientId && (
                  <CreditToggleRow cr={cr} className="py-3.5 border-b border-dashed border-line-2" editable={false} />
                )}

                <div className="flex justify-between items-center py-3.5 border-b border-dashed border-line-2 mb-4">
                  <span className="font-mono text-[11px] uppercase tracking-widest text-ink-3">Status</span>
                  <Chip variant={tabStatusVariant(selected.Status)}>{tabStatusLabel(selected.Status)}</Chip>
                </div>

                {selected.Status === 'Em aberto' ? (
                  <>
                    <div className="font-mono text-[11px] uppercase tracking-widest text-ink-3 mb-2.5">
                      Método de pagamento
                    </div>
                    <PaymentMethodSplit sp={sp} />

                    <Button variant="primary" className="w-full justify-center mt-3" onClick={handlePagar} loading={paying} disabled={!sp.valid}>
                      <Icon name="check" size={14} />
                      {sp.isFiado ? 'Registrar mensalidade' : 'Registrar pagamento'}
                    </Button>
                  </>
                ) : (
                  <>
                    <TabPaymentInfo tab={selected} />
                    {selected.Status === 'Paga' && user?.role === 'Admin' && (
                      canEditPaidTab ? (
                        <div className="mt-2.5 font-mono text-[10.5px] text-ink-3 text-center">
                          Itens editáveis acima — trava assim que a comissão for repassada.
                        </div>
                      ) : selectedCommissionPaid ? (
                        <div className="mt-2.5 font-mono text-[10.5px] text-ink-3 text-center">
                          Comissão já repassada — não é mais possível editar esta comanda.
                        </div>
                      ) : null
                    )}
                  </>
                )}

                <div className="h-px bg-line my-4" />
                <div className="font-mono text-[11px] text-ink-3">
                  Expira em {formatDate(selected.Expire_at)}
                </div>
              </div>
            </div>
          </div>
          )}
        </div>
      )}
    </>
  )
}

// ─── Sub-aba Pedidos de Produtos (Admin) ─────────────────────────────────────

// ─── Aba Relatório de Pagamentos ─────────────────────────────────────────────

const METHOD_LABELS = {
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  cartao_credito: 'Crédito',
  cartao_debito: 'Débito',
}

function TabRelatorio() {
  const now = new Date()
  const todayStr = now.toLocaleDateString('en-CA')
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const [start, setStart] = useState(firstOfMonth)
  const [end, setEnd] = useState(todayStr)
  const [payments, setPayments] = useState([])
  const [totais, setTotais] = useState(null)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  async function handleBuscar() {
    setLoading(true)
    setSearched(true)
    try {
      const { data } = await api.get(`/dashboard/payments?start=${start}&end=${end}`)
      setPayments(data.data ?? [])
      setTotais(data.totais ?? null)
    } catch {
      setPayments([])
      setTotais(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Header: filtro de período */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-6">
        <div className="flex flex-col gap-1">
          <label className="font-mono text-[10.5px] uppercase tracking-widest text-ink-4">De</label>
          <input
            type="date"
            value={start}
            max={end}
            onChange={e => setStart(e.target.value)}
            className="h-[38px] px-3 rounded-lg border border-line bg-surface text-ink-2 text-[13px] font-body focus:outline-none focus:border-brand cursor-pointer"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-mono text-[10.5px] uppercase tracking-widest text-ink-4">Até</label>
          <input
            type="date"
            value={end}
            min={start}
            onChange={e => setEnd(e.target.value)}
            className="h-[38px] px-3 rounded-lg border border-line bg-surface text-ink-2 text-[13px] font-body focus:outline-none focus:border-brand cursor-pointer"
          />
        </div>
        <Button variant="primary" onClick={handleBuscar} loading={loading} className="self-end">
          <Icon name="search" size={14} />
          Buscar
        </Button>
      </div>

      {loading ? <PageSpinner /> : !searched ? (
        <EmptyState icon="receipt" title="Selecione um período" description="Escolha as datas e clique em Buscar para gerar o relatório." />
      ) : payments.length === 0 ? (
        <EmptyState icon="cash" title="Nenhum pagamento" description="Nenhum pagamento encontrado neste período." />
      ) : (
        <>
          {/* Totalizadores */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {['pix', 'dinheiro', 'cartao_credito', 'cartao_debito'].map(m => (
              <div key={m} className="bg-surface border border-line rounded-xl p-4 flex flex-col gap-1.5">
                <span className="font-mono text-[10px] uppercase tracking-widest text-ink-4">{METHOD_LABELS[m]}</span>
                <span className="text-[22px] font-serif font-light leading-none tracking-wide text-ink">
                  <MoneyValue>{formatCurrency(totais?.[m] ?? 0)}</MoneyValue>
                </span>
              </div>
            ))}
          </div>
          <div className="bg-brand rounded-xl p-4 flex items-center justify-between mb-6">
            <span className="font-mono text-[10.5px] uppercase tracking-widest text-white/70">Total do período</span>
            <span className="text-[28px] font-serif font-light leading-none tracking-wide text-white">
              <MoneyValue>{formatCurrency(totais?.geral ?? 0)}</MoneyValue>
            </span>
          </div>

          {/* Tabela — desktop */}
          <div className="bg-surface border border-line rounded-[14px] overflow-hidden hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2">
                  <th className="text-left px-5 py-3.5 font-mono text-[10.5px] uppercase tracking-widest text-ink-4 font-normal">Data</th>
                  <th className="text-left px-5 py-3.5 font-mono text-[10.5px] uppercase tracking-widest text-ink-4 font-normal">Cliente</th>
                  <th className="text-left px-5 py-3.5 font-mono text-[10.5px] uppercase tracking-widest text-ink-4 font-normal">Profissional</th>
                  <th className="text-left px-5 py-3.5 font-mono text-[10.5px] uppercase tracking-widest text-ink-4 font-normal">Serviço</th>
                  <th className="text-left px-5 py-3.5 font-mono text-[10.5px] uppercase tracking-widest text-ink-4 font-normal">Método</th>
                  <th className="text-right px-5 py-3.5 font-mono text-[10.5px] uppercase tracking-widest text-ink-4 font-normal">Valor</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.uuid} className="border-b border-line-2 last:border-0 hover:bg-surface-2 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-[12px] text-ink-3">{formatDate(p.data)}</td>
                    <td className="px-5 py-3.5 text-[13.5px] font-medium text-ink">{p.cliente}</td>
                    <td className="px-5 py-3.5 text-[13px] text-ink-2">{p.profissional}</td>
                    <td className="px-5 py-3.5 text-[13px] text-ink-2">{p.servico}</td>
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-[11.5px] bg-surface-2 border border-line px-2 py-0.5 rounded-full">
                        {METHOD_LABELS[p.metodo] ?? p.metodo}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-[13px] font-semibold text-ink"><MoneyValue>{formatCurrency(p.valor)}</MoneyValue></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-line bg-surface-2">
                  <td colSpan={5} className="px-5 py-3.5 font-mono text-[11px] uppercase tracking-widest text-ink-3">
                    {payments.length} pagamento{payments.length !== 1 ? 's' : ''}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-[13px] font-semibold text-ink">
                    <MoneyValue>{formatCurrency(totais?.geral ?? 0)}</MoneyValue>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Cards — mobile */}
          <div className="md:hidden space-y-3">
            {payments.map(p => (
              <div key={p.uuid} className="bg-surface border border-line rounded-[14px] px-4 py-4">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="font-medium text-[14px] text-ink">{p.cliente}</span>
                  <span className="font-mono text-[13.5px] font-semibold text-ink"><MoneyValue>{formatCurrency(p.valor)}</MoneyValue></span>
                </div>
                <div className="grid grid-cols-2 gap-y-2">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-ink-4 mb-0.5">Data</div>
                    <div className="font-mono text-[12px] text-ink-3">{formatDate(p.data)}</div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-ink-4 mb-0.5">Método</div>
                    <div className="font-mono text-[12px] text-ink-2">{METHOD_LABELS[p.metodo] ?? p.metodo}</div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-ink-4 mb-0.5">Profissional</div>
                    <div className="text-[13px] text-ink-2">{p.profissional}</div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-ink-4 mb-0.5">Serviço</div>
                    <div className="text-[13px] text-ink-2">{p.servico}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function AdminCaixa() {
  const { salonSlug } = useParams()
  const { user } = useAuthStore()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const initialAppointmentId = searchParams.get('appointment')
  const initialGroup = searchParams.get('group')
  const activeTab = searchParams.get('tab') ?? 'comandas'

  function setActiveTab(tab) {
    navigate(tab === 'comandas' ? `/${salonSlug}/admin/caixa` : `/${salonSlug}/admin/caixa?tab=${tab}`, { replace: true })
  }

  const sidebar = (
    <Sidebar navItems={navItems} footerUser={user?.name} footerRole="Admin">Admin</Sidebar>
  )

  return (
    <AppLayout sidebar={sidebar}>
      {/* Header + tabs */}
      <div className="mb-5 md:mb-6">
        <h3 className="font-display font-medium text-[22px] md:text-[26px] tracking-tight mb-4">Caixa</h3>
        <div data-tour="caixa-tabs" className="flex gap-1 border-b border-line">
          {[
            { id: 'comandas', label: 'Comandas', icon: 'receipt' },
            { id: 'produtos', label: 'Produtos', icon: 'package' },
            { id: 'relatorio', label: 'Relatório', icon: 'chart' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-[13.5px] font-medium border-b-2 -mb-px transition-colors cursor-pointer
                ${activeTab === tab.id
                  ? 'border-brand text-brand'
                  : 'border-transparent text-ink-3 hover:text-ink-2'}`}
            >
              <Icon name={tab.icon} size={14} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'comandas' ? <TabComandas user={user} initialAppointmentId={initialAppointmentId} initialGroup={initialGroup} />
        : activeTab === 'produtos' ? <TabPedidosProdutos showSeller />
        : <TabRelatorio />}
    </AppLayout>
  )
}
