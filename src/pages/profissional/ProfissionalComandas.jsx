import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
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
import { useToast } from '@/context/ToastContext'
import useAuthStore from '@/store/authStore'
import api from '@/lib/api'
import { batchPayExtraMessage } from '@/lib/creditToast'
import { navItemsByRole } from '@/config/navItems'
import { usePagination } from '@/hooks/usePagination'
import { useTour } from '@/hooks/useTour'
import { profissionalComandasSteps } from '@/tours/profissionalComandasTour'
import MoneyValue from '@/components/ui/MoneyValue'
import { formatCurrency, formatDate, formatTime, tabStatusLabel, tabStatusVariant } from '@/lib/format'
import { STATUS_FILTERS, PERIOD_PRESETS, postAddService, tabDateStr, getPeriodRange, isFiadoTab } from '@/lib/caixa'
import { TabPaymentInfo } from '@/components/caixa/TabPaymentInfo'
import { TabPedidosProdutos } from '@/components/caixa/TabPedidosProdutos'

const navItems = navItemsByRole['Profissional']

export default function ProfissionalComandas() {
  const { user } = useAuthStore()
  const { addToast } = useToast()
  const [searchParams] = useSearchParams()
  const initialAppointmentId = searchParams.get('appointment')
  const initialGroup = searchParams.get('group')
  const [subTab, setSubTab] = useState('servicos')

  const [tabs, setTabs] = useState([])
  const [loading, setLoading] = useState(true)
  const { restartTour } = useTour('profissional_comandas', profissionalComandasSteps, !loading)
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

  const [batchClient, setBatchClient] = useState(null)
  const [batchPaying, setBatchPaying] = useState(false)
  const [openAccounts, setOpenAccounts] = useState([])

  // Adicionar serviço avulso à comanda selecionada — mesmo endpoint (POST /tab/:id/items)
  // já usado pelo ModalFecharConta, com um profissional escolhido na hora (pode ser
  // diferente do(s) já vinculado(s) à comanda). Profissional primeiro: nem toda
  // profissional atende todo serviço, então a lista de serviços só aparece filtrada por
  // quem já foi escolhido.
  const [professionals, setProfessionals] = useState([])
  const [newServiceProfId, setNewServiceProfId] = useState('')
  const [profServices, setProfServices] = useState([])
  const [loadingProfServices, setLoadingProfServices] = useState(false)
  const [newServiceId, setNewServiceId] = useState('')
  const [addingService, setAddingService] = useState(false)
  const [conflictModal, setConflictModal] = useState(null) // { serviceId, professionalId, message }
  const [confirmingOverlap, setConfirmingOverlap] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get('/users', { params: { Role: 'Profissional', limit: 100 } }),
      api.get('/users', { params: { Role: 'Admin', limit: 100 } }),
    ])
      .then(([a, b]) => setProfessionals([...(a.data.data ?? []), ...(b.data.data ?? [])]))
      .catch(() => setProfessionals([]))
  }, [])

  useEffect(() => {
    if (!newServiceProfId) { setProfServices([]); return }
    setLoadingProfServices(true)
    api.get('/service', { params: { professional: newServiceProfId, limit: 100 } })
      .then(({ data }) => setProfServices(data.data ?? []))
      .catch(() => setProfServices([]))
      .finally(() => setLoadingProfServices(false))
  }, [newServiceProfId])

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

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [apptRes, tabRes, accountsRes] = await Promise.all([
        api.get('/appointment/my', { params: { limit: 500 } }),
        api.get('/tab', { params: { limit: 1000 } }),
        api.get('/tab/open-accounts'),
      ])
      const apptUUIDs = new Set((apptRes.data.data ?? []).map(a => a.UUID))
      const myTabs = (tabRes.data.data ?? []).filter(t => t.Appointment && apptUUIDs.has(t.Appointment.UUID))
      setTabs(myTabs)
      setOpenAccounts(accountsRes.data.data ?? [])
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
    : tabs.filter(t => {
        if (statusFilter === 'Paga') return t.Status === 'Paga' || t.Status === 'Pago'
        return t.Status === statusFilter
      })

  const { from: periodFrom, to: periodTo } = periodPreset === 'personalizado'
    ? { from: customFrom || null, to: customTo || null }
    : getPeriodRange(periodPreset)

  const filteredByPeriod = (!periodFrom && !periodTo)
    ? filteredByStatus
    : filteredByStatus.filter(t => {
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
  const filtered = search_
    ? filteredByMensalista.filter(t => (t.Appointment?.Client ?? '').toLowerCase().includes(search_))
    : filteredByMensalista

  const { pageItems: pagedTabs, page, setPage, totalPages } = usePagination(filtered, 20)

  useEffect(() => { setPage(1) }, [statusFilter, periodFrom, periodTo, search, onlyMensalista])

  const selected = tabs.find(t => t.UUID === selectedId)

  const emAberto = tabs.filter(t => t.Status === 'Em aberto').length
  const totalAberto = tabs.filter(t => t.Status === 'Em aberto').reduce((s, t) => s + t.Value, 0)

  const cr = useCreditAndTroco({
    clientId: selected?.Appointment?.ClientId,
    total: selected?.Value ?? 0,
    resetKey: selectedId,
  })
  const sp = usePaymentSplit({ total: cr.remainingAfterCredit, resetKey: selectedId })

  useEffect(() => {
    if (!selectedId) { setSelectedItems([]); return }
    api.get(`/tab/${selectedId}`)
      .then(({ data }) => setSelectedItems(data.Tab_items ?? []))
      .catch(() => setSelectedItems([]))
  }, [selectedId])

  // Edita o Unit_price de um item da comanda selecionada — mesmo padrão do
  // ModalFecharConta.jsx (PATCH /tab/:id/items/:itemId recalcula Tab.Value via trigger no
  // banco; local só espelha a mesma soma pra não precisar rebuscar tudo).
  async function handleUpdateItemPrice(item, rawValue) {
    setEditingItemId(null)
    const newPrice = parseFloat(String(rawValue).replace(',', '.'))
    if (!Number.isFinite(newPrice) || newPrice < 0 || newPrice === item.Unit_price) return
    setUpdatingItemId(item.UUID)
    try {
      const { data: updatedItem } = await api.patch(`/tab/${selected.UUID}/items/${item.UUID}`, { Unit_price: newPrice })
      const nextItems = selectedItems.map(i =>
        i.UUID === updatedItem.UUID ? { ...i, Unit_price: updatedItem.Unit_price, Quantity: updatedItem.Quantity } : i
      )
      setSelectedItems(nextItems)
      setTabs(prev => prev.map(t => t.UUID === selected.UUID
        ? { ...t, Value: nextItems.filter(i => i.Status !== 'pago').reduce((s, i) => s + i.Unit_price * i.Quantity, 0) }
        : t
      ))
    } catch (err) {
      addToast(err.response?.data?.error || 'Erro ao atualizar valor do item', 'error')
    } finally {
      setUpdatingItemId(null)
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

  async function handlePagar() {
    if (!selected) return
    setPaying(true)
    try {
      // Mesma RPC do "Fechar conta" (batch_pay_tabs), com um único tab_id — ver comentário
      // equivalente em AdminCaixa.jsx: o caminho antigo fechava comanda multi-item sem
      // tocar nos Tab_items e perdia a comissão dos demais profissionais.
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

  const sidebar = (
    <Sidebar navItems={navItems} footerUser={user?.name} footerRole="Profissional" />
  )

  return (
    <AppLayout sidebar={sidebar}>
      <div className="mb-5 md:mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-medium text-[22px] md:text-[26px] tracking-tight">Comandas</h3>
          <button onClick={restartTour} className="inline-flex items-center gap-1 text-[11px] text-ink-4 hover:text-brand transition-colors" title="Repetir tour guiado">
            <Icon name="helpCircle" size={12} />
            Ver tour
          </button>
        </div>
        <div data-tour="sub-abas" className="flex gap-1 border-b border-line">
          {[['servicos', 'Serviços', 'scissors'], ['produtos', 'Produtos', 'package']].map(([id, label, icon]) => (
            <button key={id} onClick={() => setSubTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-[13.5px] font-medium border-b-2 -mb-px transition-colors cursor-pointer
                ${subTab === id ? 'border-brand text-brand' : 'border-transparent text-ink-3 hover:text-ink-2'}`}>
              <Icon name={icon} size={14} />{label}
            </button>
          ))}
        </div>
      </div>

      {subTab === 'produtos' ? <TabPedidosProdutos /> : null}

      {subTab === 'servicos' && <>

      <div className="flex items-center justify-between mb-5 md:mb-6">
        <p className="text-[12px] md:text-[13px] text-ink-3">
          {emAberto} em aberto · <MoneyValue>{formatCurrency(totalAberto)}</MoneyValue> a receber
        </p>
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
          {STATUS_FILTERS.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`inline-flex items-center px-2.5 py-[4px] rounded-full text-xs font-medium border cursor-pointer transition-colors
                ${statusFilter === s ? 'bg-ink text-bg border-ink' : 'bg-surface-2 text-ink-2 border-line hover:border-ink-3'}`}>
              {s}
            </button>
          ))}
          <button onClick={() => setOnlyMensalista(v => !v)}
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

      <Modal
        isOpen={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        onConfirm={handleDeleteTab}
        title="Excluir comanda"
        message={`Excluir a comanda de "${deleteModal?.Appointment?.Client ?? 'cliente'}"? Esta ação não pode ser desfeita.`}
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
        <EmptyState icon="tag" title="Nenhuma comanda" description="Suas comandas aparecerão aqui após os atendimentos." />
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
                <Avatar name={t.Appointment?.Client ?? '?'} index={idx} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <div className="text-[13px] md:text-[13.5px] font-medium truncate">{t.Appointment?.Client ?? 'Sem agendamento'}</div>
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
                  {selected.Appointment?.Client ?? 'Comanda avulsa'}
                </h4>
                {selected.Appointment && (
                  <div className="font-mono text-[11.5px] text-ink-3 mt-1">
                    {selected.Appointment.Service
                      ? `${selected.Appointment.Service} · ${formatDate(selected.Appointment.Date)} · ${formatTime(selected.Appointment.Start_time)}`
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
                        <div key={item.UUID} className="flex items-center justify-between gap-2 text-[13px]">
                          <span className="text-ink-2 truncate flex items-center gap-1.5">
                            {(item.Item_type === 'product' ? item.Product?.Name : item.Service?.Name) ?? '—'}
                            {item.Quantity > 1 ? ` ×${item.Quantity}` : ''}
                            {item.Via_package && (
                              <span className="inline-flex items-center px-1.5 py-[1px] rounded-full text-[10px] font-medium bg-brand-soft text-brand shrink-0">
                                Pago no pacote
                              </span>
                            )}
                          </span>
                          {item.Status === 'pago'
                            ? <span className="font-mono text-ink-4 shrink-0"><MoneyValue>{formatCurrency(item.Unit_price * item.Quantity)}</MoneyValue></span>
                            : selected.Status === 'Em aberto' && user?.role === 'Admin'
                              ? renderItemPrice(item)
                              : <span className="font-mono shrink-0"><MoneyValue>{formatCurrency(item.Unit_price * item.Quantity)}</MoneyValue></span>}
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
                  <TabPaymentInfo tab={selected} />
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
      </>}
    </AppLayout>
  )
}
