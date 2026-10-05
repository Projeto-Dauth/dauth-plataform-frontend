import { useState, useEffect } from 'react'
import Icon from '@/components/ui/Icons'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import CreditAndTrocoFields from '@/components/ui/CreditAndTrocoFields'
import api from '@/lib/api'
import useAuthStore from '@/store/authStore'
import { useToast } from '@/context/ToastContext'
import MoneyValue from '@/components/ui/MoneyValue'
import { formatCurrency, formatDate, formatTime } from '@/lib/format'

const inputClsAddProd = 'h-[38px] px-3 rounded-md border border-line bg-surface text-ink-2 text-[13px] placeholder:text-ink-4 focus:outline-none focus:border-brand transition-colors w-full'

// Data/hora calculadas no navegador (não no servidor) — evita o bug de fuso horário já
// documentado no projeto quando "agora" é calculado no backend.
function nowDateAndTime() {
  const now = new Date()
  return {
    date: now.toLocaleDateString('en-CA'),
    time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
  }
}

export default function ModalFecharConta({ client, paying, onClose, onConfirm }) {
  const { addToast } = useToast()
  const { user } = useAuthStore()
  // Só Admin altera valor de item/produto da comanda — profissional apenas visualiza.
  const canEditPrice = user?.role === 'Admin'
  const [visible, setVisible] = useState(false)
  const [removedTabIds, setRemovedTabIds] = useState(new Set())
  const [removedItemIds, setRemovedItemIds] = useState(new Set())
  const [orderQty, setOrderQty] = useState({}) // { [orderId]: quantidade a pagar agora }
  const [clientData, setClientData] = useState(client)
  const [products, setProducts] = useState([])
  const [productSearch, setProductSearch] = useState('')
  const [addingProductId, setAddingProductId] = useState(null)
  const [addTab, setAddTab] = useState('produtos') // 'produtos' | 'servicos'
  const [professionals, setProfessionals] = useState([])
  const [selectedProfessionalId, setSelectedProfessionalId] = useState('')
  const [professionalServices, setProfessionalServices] = useState([])
  const [loadingProfServices, setLoadingProfServices] = useState(false)
  const [serviceSearch, setServiceSearch] = useState('')
  const [addingServiceId, setAddingServiceId] = useState(null)
  const [conflictModal, setConflictModal] = useState(null) // { service, professionalId, message }
  const [confirmingOverlap, setConfirmingOverlap] = useState(false)
  const [editingItemId, setEditingItemId] = useState(null)
  const [updatingItemId, setUpdatingItemId] = useState(null)
  const [editingOrderId, setEditingOrderId] = useState(null)
  const [updatingOrderId, setUpdatingOrderId] = useState(null)
  const [removingOrderId, setRemovingOrderId] = useState(null)
  const [payExtra, setPayExtra] = useState({ paymentBody: {}, remainingAfterCredit: null, valid: true, isFiado: false })

  useEffect(() => {
    setClientData(client)
    setRemovedTabIds(new Set())
    setRemovedItemIds(new Set())
    setOrderQty(Object.fromEntries((client?.orders ?? []).map(o => [o.UUID, o.Quantity])))
  }, [client?.client_id])

  useEffect(() => {
    api.get('/product', { params: { limit: 100 } })
      .then(({ data }) => setProducts((data.data ?? []).filter(p => p.Active)))
      .catch(() => {})
    Promise.all([
      api.get('/users', { params: { Role: 'Profissional', limit: 100 } }),
      api.get('/users', { params: { Role: 'Admin', limit: 100 } }),
    ])
      .then(([profRes, adminRes]) => setProfessionals([...(profRes.data.data ?? []), ...(adminRes.data.data ?? [])]))
      .catch(() => {})
  }, [])

  // Nem toda profissional faz todo serviço — a lista de serviços só aparece depois de
  // escolher a profissional, filtrada pelos vínculos dela (mesmo endpoint já usado no
  // resto do app para popular select de Serviço a partir de um profissional escolhido).
  useEffect(() => {
    if (!selectedProfessionalId) { setProfessionalServices([]); return }
    setLoadingProfServices(true)
    api.get('/service', { params: { professional: selectedProfessionalId, limit: 100 } })
      .then(({ data }) => setProfessionalServices(data.data ?? []))
      .catch(() => setProfessionalServices([]))
      .finally(() => setLoadingProfServices(false))
  }, [selectedProfessionalId])

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  if (!clientData) return null

  // Comanda sem Tab_items (combo/legado) só pode ser removida inteira; comanda com itens
  // é removida item a item — numa comanda de atendimento combinado (Booking_group) todos
  // os serviços vivem na MESMA Tab, então remover pela Tab riscava o grupo inteiro.
  const toggleTab = (id) => {
    setRemovedTabIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  const toggleItem = (id) => {
    setRemovedItemIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  const setQty = (o, qty) => {
    setOrderQty(prev => ({ ...prev, [o.UUID]: Math.max(0, Math.min(o.Quantity, qty)) }))
  }

  const refreshSummary = async () => {
    try {
      const { data } = await api.get(`/tab/client/${clientData.client_id}/account-summary`)
      setClientData(data)
      setOrderQty(prev => {
        const next = { ...prev }
        for (const o of data.orders ?? []) {
          if (!(o.UUID in next)) next[o.UUID] = o.Quantity
        }
        return next
      })
    } catch { /* mantém o estado anterior se o refresh falhar */ }
  }

  const handleAddProduct = async (product) => {
    setAddingProductId(product.UUID)
    try {
      await api.post('/product-order', { Product_id: product.UUID, Client_id: clientData.client_id, Quantity: 1 })
      addToast(`${product.Name} adicionado à conta`, 'success')
      await refreshSummary()
    } catch (err) {
      addToast(err.response?.data?.error || 'Erro ao adicionar produto', 'error')
    } finally {
      setAddingProductId(null)
    }
  }

  // Edita o Unit_price de um item específico da comanda (Tab_items) — o backend
  // (PATCH /tab/:id/items/:itemId) recalcula Tab.Value automaticamente via trigger, então
  // basta rebuscar o resumo da conta pra refletir o novo total, sem somar nada aqui.
  const handleUpdateItemPrice = async (tabId, item, rawValue) => {
    setEditingItemId(null)
    const newPrice = parseFloat(String(rawValue).replace(',', '.'))
    if (!Number.isFinite(newPrice) || newPrice < 0 || newPrice === item.Unit_price) return
    setUpdatingItemId(item.UUID)
    try {
      const { data: updatedItem } = await api.patch(`/tab/${tabId}/items/${item.UUID}`, { Unit_price: newPrice })
      // Atualiza o estado local em vez de rebuscar /account-summary inteiro — esse GET
      // encadeia várias queries sequenciais no Supabase (findTabIdsByClient sozinho já faz
      // 4) e deixava a edição de preço lenta. Tab.Value aqui é só a mesma soma que o
      // trigger recalc_tab_value já faz no banco, então recalcular no cliente é seguro.
      setClientData(prev => ({
        ...prev,
        tabs: prev.tabs.map(t => {
          if (t.UUID !== tabId) return t
          const items = (t.Items ?? []).map(i =>
            i.UUID === updatedItem.UUID ? { ...i, Unit_price: updatedItem.Unit_price, Quantity: updatedItem.Quantity } : i
          )
          return { ...t, Items: items, Value: items.reduce((s, i) => s + i.Unit_price * i.Quantity, 0) }
        })
      }))
    } catch (err) {
      addToast(err.response?.data?.error || 'Erro ao atualizar valor do item', 'error')
    } finally {
      setUpdatingItemId(null)
    }
  }

  const renderItemPrice = (tabId, item, displayClassName = 'font-mono shrink-0') => {
    if (!canEditPrice) {
      return <span className={displayClassName}><MoneyValue>{formatCurrency(item.Unit_price * item.Quantity)}</MoneyValue></span>
    }
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
          onBlur={e => handleUpdateItemPrice(tabId, item, e.target.value.replace(',', '.'))}
          onKeyDown={e => {
            if (e.key === 'Enter') e.target.blur()
            if (e.key === 'Escape') { e.target.value = item.Unit_price; e.target.blur() }
          }}
          onClick={e => e.stopPropagation()}
          className="w-20 h-6 px-1.5 rounded border border-brand bg-surface text-ink text-[12.5px] font-mono text-right focus:outline-none shrink-0"
        />
      )
    }
    const isUpdating = updatingItemId === item.UUID
    return (
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setEditingItemId(item.UUID) }}
        disabled={isUpdating}
        title="Editar valor do item"
        className={`${displayClassName} text-left hover:text-brand hover:underline decoration-dotted underline-offset-2 cursor-pointer disabled:opacity-50 disabled:cursor-wait transition-colors`}
      >
        <MoneyValue>{formatCurrency(item.Unit_price * item.Quantity)}</MoneyValue>
      </button>
    )
  }

  // Edita o Unit_price de um pedido de produto pendente (ProductOrder) — mesmo padrão do
  // handleUpdateItemPrice, mas via PATCH /product-order/:id (endpoint só aceita editar
  // valor enquanto o pedido está 'encomendado', backend recusa com 409 se já pago).
  const handleUpdateOrderPrice = async (order, rawValue) => {
    setEditingOrderId(null)
    const newPrice = parseFloat(String(rawValue).replace(',', '.'))
    if (!Number.isFinite(newPrice) || newPrice < 0 || newPrice === order.Unit_price) return
    setUpdatingOrderId(order.UUID)
    try {
      const { data: updatedOrder } = await api.patch(`/product-order/${order.UUID}`, { Unit_price: newPrice })
      setClientData(prev => ({
        ...prev,
        orders: prev.orders.map(o => o.UUID === order.UUID ? { ...o, Unit_price: updatedOrder.Unit_price } : o)
      }))
    } catch (err) {
      addToast(err.response?.data?.error || 'Erro ao atualizar valor do produto', 'error')
    } finally {
      setUpdatingOrderId(null)
    }
  }

  // Remove de vez um pedido de produto pendente da comanda do cliente (DELETE /product-order/:id)
  // — diferente do botão x/+ ao lado, que só exclui o item do pagamento atual sem apagá-lo.
  const handleDeleteOrder = async (order) => {
    setRemovingOrderId(order.UUID)
    try {
      await api.delete(`/product-order/${order.UUID}`)
      setClientData(prev => ({ ...prev, orders: prev.orders.filter(o => o.UUID !== order.UUID) }))
      setOrderQty(prev => {
        const next = { ...prev }
        delete next[order.UUID]
        return next
      })
      addToast(`${order.Product?.Name} removido da comanda`, 'success')
    } catch (err) {
      addToast(err.response?.data?.error || 'Erro ao remover produto', 'error')
    } finally {
      setRemovingOrderId(null)
    }
  }

  const renderOrderPrice = (order) => {
    if (!canEditPrice) {
      return (
        <span className="font-mono font-medium text-ink shrink-0 w-16 text-right">
          <MoneyValue>{formatCurrency((orderQty[order.UUID] ?? 0) * order.Unit_price)}</MoneyValue>
        </span>
      )
    }
    if (editingOrderId === order.UUID) {
      return (
        <input
          autoFocus
          type="text"
          inputMode="decimal"
          defaultValue={order.Unit_price}
          onInput={e => {
            const cleaned = e.target.value.replace(/[^0-9.,]/g, '')
            if (cleaned !== e.target.value) e.target.value = cleaned
          }}
          onBlur={e => handleUpdateOrderPrice(order, e.target.value.replace(',', '.'))}
          onKeyDown={e => {
            if (e.key === 'Enter') e.target.blur()
            if (e.key === 'Escape') { e.target.value = order.Unit_price; e.target.blur() }
          }}
          onClick={e => e.stopPropagation()}
          className="w-16 h-6 px-1.5 rounded border border-brand bg-surface text-ink text-[12.5px] font-mono text-right focus:outline-none shrink-0"
        />
      )
    }
    const isUpdating = updatingOrderId === order.UUID
    return (
      <button
        type="button"
        onClick={() => setEditingOrderId(order.UUID)}
        disabled={isUpdating}
        title="Editar valor do produto"
        className="font-mono font-medium text-ink shrink-0 w-16 text-right hover:text-brand hover:underline decoration-dotted underline-offset-2 cursor-pointer disabled:opacity-50 disabled:cursor-wait transition-colors"
      >
        <MoneyValue>{formatCurrency((orderQty[order.UUID] ?? 0) * order.Unit_price)}</MoneyValue>
      </button>
    )
  }

  // Backend usa Date/Start_time pra também representar esse serviço na Agenda da
  // profissional (funde no agendamento dela se ela já atende essa comanda, ou cria um novo
  // ligado por Booking_group) — ver tabController.addItem.
  const postAddService = (service, professionalId, confirmOverlap = false) => {
    const { date, time } = nowDateAndTime()
    return api.post(`/tab/${clientData.tabs[0]?.UUID ?? ''}/items`, {
      Item_type: 'service',
      Service_id: service.UUID,
      Professional_id: professionalId,
      Quantity: 1,
      Date: date,
      Start_time: time,
      Confirm_overlap: confirmOverlap,
    })
  }

  const handleAddService = async (service) => {
    if (!selectedProfessionalId) return
    setAddingServiceId(service.UUID)
    try {
      await postAddService(service, selectedProfessionalId)
      const professionalName = professionals.find(p => p.UUID === selectedProfessionalId)?.Name ?? ''
      addToast(`${service.Name} adicionado à conta${professionalName ? ` (${professionalName})` : ''}`, 'success')
      await refreshSummary()
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.conflict) {
        setConflictModal({ service, professionalId: selectedProfessionalId, message: err.response.data.error })
      } else {
        addToast(err.response?.data?.error || 'Erro ao adicionar serviço', 'error')
      }
    } finally {
      setAddingServiceId(null)
    }
  }

  const handleConfirmOverlap = async () => {
    if (!conflictModal) return
    setConfirmingOverlap(true)
    try {
      await postAddService(conflictModal.service, conflictModal.professionalId, true)
      const professionalName = professionals.find(p => p.UUID === conflictModal.professionalId)?.Name ?? ''
      addToast(`${conflictModal.service.Name} adicionado à conta${professionalName ? ` (${professionalName})` : ''}`, 'success')
      await refreshSummary()
      setConflictModal(null)
    } catch (err) {
      addToast(err.response?.data?.error || 'Erro ao adicionar serviço', 'error')
    } finally {
      setConfirmingOverlap(false)
    }
  }

  const filteredProducts = productSearch
    ? products.filter(p => p.Name.toLowerCase().includes(productSearch.toLowerCase()))
    : products

  const filteredServices = serviceSearch
    ? professionalServices.filter(s => s.Name.toLowerCase().includes(serviceSearch.toLowerCase()))
    : professionalServices

  // Itens já pagos via sessão de combo (Paid=true) entram só pra exibição — nunca contam
  // pro total, nunca vão no payload de pagamento, sem toggle de remover (já não há o que
  // remover, a cliente não deve nada por eles). `tabItems` é a base usada em toda conta de
  // cobrança daqui pra baixo; a lista completa (pra render) fica em `t.Items` direto.
  const tabItems = (t) => (t.Items ?? []).filter(i => !i.Paid)
  const keptItems = (t) => tabItems(t).filter(i => !removedItemIds.has(i.UUID))
  // Uma Tab entra no lote se sobrou algum item nela (ou, sem itens, se não foi removida).
  // Os itens riscados vão em excluded_item_ids: continuam 'pendente' no banco e seguram a
  // comanda em aberto para uma cobrança futura.
  const includedTabs = clientData.tabs.filter(t =>
    tabItems(t).length > 0 ? keptItems(t).length > 0 : !removedTabIds.has(t.UUID)
  )
  const remainingTabIds = includedTabs.map(t => t.UUID)
  const excludedItemIds = includedTabs.flatMap(t => tabItems(t).filter(i => removedItemIds.has(i.UUID)).map(i => i.UUID))
  const orderPayments = clientData.orders
    .filter(o => (orderQty[o.UUID] ?? 0) > 0)
    .map(o => ({ order_id: o.UUID, quantity: orderQty[o.UUID] }))

  const total =
    includedTabs.reduce((s, t) => s + (tabItems(t).length > 0
      ? keptItems(t).reduce((si, i) => si + i.Unit_price * i.Quantity, 0)
      : t.Value), 0) +
    clientData.orders.reduce((s, o) => s + (orderQty[o.UUID] ?? 0) * o.Unit_price, 0)

  const remainingAfterCredit = payExtra.remainingAfterCredit ?? total
  const creditFieldsValid = payExtra.valid

  const canConfirm = remainingTabIds.length + orderPayments.length > 0 && creditFieldsValid

  const handleConfirmClick = () => {
    onConfirm(remainingTabIds, orderPayments, excludedItemIds, payExtra.paymentBody)
  }

  return (
    <div className="fixed inset-y-0 left-0 right-0 md:left-[240px] z-50 flex flex-col">
      <div
        className={`bg-surface w-full h-full shadow-2xl flex flex-col md:border-l border-line transition-transform duration-300 ease-out ${
          visible ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="px-6 py-5 border-b border-line flex justify-between items-center shrink-0">
          <div>
            <span className="font-mono text-[10.5px] uppercase tracking-widest text-ink-3">Fechar conta</span>
            <h4 className="font-display font-medium text-[18px] tracking-tight mt-1">{clientData.client_name}</h4>
          </div>
          <button onClick={onClose} className="text-ink-3 hover:text-ink transition-colors cursor-pointer">
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="flex flex-col md:flex-row flex-1 min-h-0">
        <div className="flex-1 min-w-0 flex flex-col md:border-r border-line">
        <div className="px-6 pt-5 overflow-y-auto flex-1 min-h-0 scrollbar-hidden">
          <div className="grid grid-cols-[1.3fr_1fr_0.85fr_0.6fr_5rem_24px] gap-2 items-center mb-2 px-0.5 font-mono text-[9.5px] uppercase tracking-widest text-ink-4">
            <span>Serviço</span>
            <span>Profissional</span>
            <span>Dia</span>
            <span>Hora</span>
            <span>Valor</span>
            <span />
          </div>
          <div className="space-y-1.5 mb-5">
            {clientData.tabs.flatMap(t => {
              const items = t.Items ?? []
              // Comanda de compra de pacote (sem Appointment, sem Tab_items) — não tem
              // "serviço"/dia/hora próprios, é a compra em si. `t.Package` (nome do combo)
              // vem do backend quando aplicável; sem ele, cai no rótulo genérico antigo.
              const isCombo = items.length === 0 && !t.Appointment
              // Comanda inteira da cliente numa lista única — 1 linha por serviço/produto,
              // sem distinguir visualmente "atendimento combinado" (Booking_group) de
              // comanda solta: continuam sendo Tabs separadas no banco (preserva comissão
              // por profissional), mas a exibição é uniforme. O toggle de remoção age por
              // item quando a Tab tem Tab_items; só cai pro nível da Tab quando não há
              // itens (combo/legado), que é o único caso sem granularidade possível.
              const rows = items.length > 0 ? items : [null]
              return rows.map(it => ({
                t,
                it,
                ativo: it ? !removedItemIds.has(it.UUID) : !removedTabIds.has(t.UUID),
                isCombo,
                isProduct: it?.Item_type === 'product',
              }))
            })
              // Produtos sempre por último — não têm dia/hora de atendimento próprios.
              .sort((a, b) => (a.isProduct === b.isProduct ? 0 : a.isProduct ? 1 : -1))
              .flatMap(({ t, it, ativo, isCombo, isProduct }, idx, arr) => {
                if (it?.Paid) {
                  // Já quitado — informativo, sem toggle (não há o que remover) e sem preço
                  // editável. `Via_package` distingue sessão de combo (badge "Pago no
                  // pacote") de item quitado normalmente dentro de uma comanda paga em
                  // etapas (excluded_item_ids) — os dois têm Status='pago', só o primeiro
                  // veio de uma Transaction com Gross_amount=0 (ver isPaidViaPackage no
                  // backend).
                  const row = (
                    <div key={it.UUID} className="grid grid-cols-[1.3fr_1fr_0.85fr_0.6fr_5rem_24px] gap-2 items-center text-[13px] opacity-70">
                      <span className="truncate text-ink-2 flex items-center gap-1.5">
                        {it.Name}
                        <span className="inline-flex items-center px-1.5 py-[1px] rounded-full text-[10px] font-medium bg-brand-soft text-brand shrink-0">
                          {it.Via_package ? 'Pago no pacote' : 'Pago'}
                        </span>
                      </span>
                      <span className="truncate text-ink-2">{it.Professional ?? ''}</span>
                      <span className="truncate text-ink-2">{formatDate(t.Appointment?.Date)}</span>
                      <span className="truncate text-ink-2">{formatTime(it.Start_time ?? t.Appointment?.Start_time)}</span>
                      <span className="font-mono text-ink-4 shrink-0">—</span>
                      <span />
                    </div>
                  )
                  return [row]
                }
                const row = (
                  <div
                    key={it?.UUID ?? t.UUID}
                    className={`grid grid-cols-[1.3fr_1fr_0.85fr_0.6fr_5rem_24px] gap-2 items-center text-[13px] transition-opacity ${ativo ? '' : 'opacity-40'}`}
                  >
                  <span className={`flex items-center gap-1 min-w-0 text-ink-2 ${ativo ? '' : 'line-through'}`}>
                    <span className="truncate">
                      {it
                        ? (it.Item_type === 'product' && it.Quantity > 1 ? `${it.Name} ×${it.Quantity}` : it.Name)
                        : isCombo ? (t.Package?.Name ? `Pacote: ${t.Package.Name}` : 'Compra de pacote') : t.Appointment?.Service ?? 'Comanda'}
                    </span>
                    {!isProduct && t.Appointment?.Recurring_appointment_id && (
                      <span title="Agendamento recorrente" className="flex-shrink-0 text-ink-4">
                        <Icon name="repeat" size={11} />
                      </span>
                    )}
                  </span>
                  <span className={`truncate text-ink-2 ${ativo ? '' : 'line-through'}`}>{it?.Professional ?? t.Appointment?.Professional ?? ''}</span>
                  <span className={`truncate text-ink-2 ${ativo ? '' : 'line-through'}`}>{it?.Item_type === 'product' ? '—' : formatDate(t.Appointment?.Date)}</span>
                  <span className={`truncate text-ink-2 ${ativo ? '' : 'line-through'}`}>{it?.Item_type === 'product' ? '—' : formatTime(it?.Start_time ?? t.Appointment?.Start_time)}</span>
                  {it
                    ? renderItemPrice(t.UUID, it, 'font-mono font-medium text-ink shrink-0')
                    : <span className="font-mono font-medium text-ink shrink-0"><MoneyValue>{formatCurrency(t.Value)}</MoneyValue></span>}
                  <button
                    onClick={() => (it ? toggleItem(it.UUID) : toggleTab(t.UUID))}
                    title={ativo ? 'Deixar fora deste pagamento (continua em aberto)' : 'Incluir neste pagamento'}
                    className={`shrink-0 w-6 h-6 flex items-center justify-center rounded-full border transition-colors cursor-pointer ${
                      ativo ? 'border-danger/40 text-danger hover:bg-danger-soft' : 'border-success/40 text-success hover:bg-success/10'
                    }`}>
                    <Icon name={ativo ? 'x' : 'plus'} size={11} />
                  </button>
                </div>
                )
                const isFirstProduct = isProduct && (idx === 0 || !arr[idx - 1].isProduct)
                return isFirstProduct
                  ? [(
                    <div key={`${it?.UUID ?? t.UUID}-header`} className="pt-2 border-t border-dashed border-line-2">
                      <span className="font-mono text-[10.5px] uppercase tracking-widest text-ink-3">Produtos</span>
                    </div>
                  ), row]
                  : [row]
              })}
            {clientData.orders.length > 0 && (
              <>
                <div className="pt-2 border-t border-dashed border-line-2">
                  <span className="font-mono text-[10.5px] uppercase tracking-widest text-ink-3">Produtos</span>
                </div>
                {clientData.orders.map(o => {
                  const qty = orderQty[o.UUID] ?? 0
                  const ativo = qty > 0
                  return (
                    <div key={o.UUID} className={`flex items-center gap-2 text-[13px] transition-opacity ${ativo ? '' : 'opacity-40'}`}>
                      <span className={`flex-1 min-w-0 truncate text-ink-2 ${ativo ? '' : 'line-through'}`}>
                        {o.Product?.Name}
                      </span>
                      {o.Quantity > 1 && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => setQty(o, qty - 1)}
                            disabled={qty <= 0}
                            className="w-5 h-5 flex items-center justify-center rounded-full border border-line text-ink-3 hover:border-ink-3 hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors">
                            −
                          </button>
                          <span className="font-mono text-[11.5px] text-ink-2 w-4 text-center">{qty}</span>
                          <button
                            onClick={() => setQty(o, qty + 1)}
                            disabled={qty >= o.Quantity}
                            className="w-5 h-5 flex items-center justify-center rounded-full border border-line text-ink-3 hover:border-ink-3 hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors">
                            +
                          </button>
                        </div>
                      )}
                      {renderOrderPrice(o)}
                      <button
                        onClick={() => setQty(o, ativo ? 0 : o.Quantity)}
                        title={ativo ? 'Excluir da cobrança atual' : 'Incluir na cobrança atual'}
                        className={`shrink-0 w-6 h-6 flex items-center justify-center rounded-full border transition-colors cursor-pointer ${
                          ativo ? 'border-danger/40 text-danger hover:bg-danger-soft' : 'border-success/40 text-success hover:bg-success/10'
                        }`}>
                        <Icon name={ativo ? 'x' : 'plus'} size={11} />
                      </button>
                      <button
                        onClick={() => handleDeleteOrder(o)}
                        disabled={removingOrderId === o.UUID}
                        title="Remover produto da comanda"
                        className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full border border-line text-ink-3 hover:border-danger/40 hover:text-danger disabled:opacity-50 disabled:cursor-wait cursor-pointer transition-colors">
                        <Icon name="trash" size={11} />
                      </button>
                    </div>
                  )
                })}
              </>
            )}
          </div>
        </div>
        <div className="px-6 pb-6 pt-4 border-t border-line shrink-0">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-dashed border-line-2">
            <span className="font-mono text-[11px] uppercase tracking-widest text-ink-3">Total</span>
            <span className="font-display text-[20px] font-medium text-ink"><MoneyValue>{formatCurrency(total)}</MoneyValue></span>
          </div>

          <div className="font-mono text-[10.5px] uppercase tracking-widest text-ink-3 mb-2">Método de pagamento</div>

          <CreditAndTrocoFields
            clientId={clientData.client_id}
            total={total}
            resetKey={clientData.client_id}
            onChange={setPayExtra}
          />

          <Button
            variant="primary"
            className="w-full justify-center mt-3"
            onClick={handleConfirmClick}
            disabled={!canConfirm}
            loading={paying}
          >
            <Icon name="check" size={14} />
            {payExtra.isFiado ? 'Registrar mensalidade · ' : 'Fechar conta · '}<MoneyValue>{formatCurrency(remainingAfterCredit)}</MoneyValue>
          </Button>
        </div>
        </div>

        <div className="w-full md:w-[300px] shrink-0 flex flex-col border-t md:border-t-0 border-line">
          <div className="px-5 py-4 border-b border-line shrink-0">
            <span className="font-mono text-[10.5px] uppercase tracking-widest text-ink-3">Adicionar à conta</span>
            <div className="flex gap-1 mt-2">
              <button
                type="button"
                onClick={() => setAddTab('produtos')}
                className={`px-2.5 py-1 rounded-full text-[12px] font-medium transition-colors cursor-pointer ${addTab === 'produtos' ? 'bg-brand text-white' : 'text-ink-3 hover:text-ink'}`}>
                Produtos
              </button>
              <button
                type="button"
                onClick={() => setAddTab('servicos')}
                className={`px-2.5 py-1 rounded-full text-[12px] font-medium transition-colors cursor-pointer ${addTab === 'servicos' ? 'bg-brand text-white' : 'text-ink-3 hover:text-ink'}`}>
                Serviços
              </button>
            </div>
          </div>

          {addTab === 'produtos' ? (
            <>
              <div className="px-5 py-3 border-b border-line shrink-0">
                <input
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  placeholder="Buscar produto..."
                  className={inputClsAddProd}
                />
              </div>
              <div className="overflow-y-auto flex-1 min-h-0 scrollbar-hidden max-h-[240px] md:max-h-none">
                {filteredProducts.length === 0 ? (
                  <div className="px-5 py-6 text-center text-ink-3 text-[12.5px]">Nenhum produto encontrado</div>
                ) : filteredProducts.map(p => (
                  <div key={p.UUID} className="flex items-center justify-between gap-2 px-5 py-2.5 border-b border-line-2 last:border-0">
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-medium truncate">{p.Name}</div>
                      <div className="font-mono text-[11px] text-ink-3"><MoneyValue>{formatCurrency(p.Price)}</MoneyValue> · estoque {p.Stock}</div>
                    </div>
                    <button
                      onClick={() => handleAddProduct(p)}
                      disabled={addingProductId === p.UUID}
                      title="Adicionar à conta"
                      className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full bg-brand text-white hover:bg-brand/90 disabled:opacity-50 transition-colors cursor-pointer">
                      <Icon name="plus" size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : clientData.tabs.length === 0 ? (
            <div className="px-5 py-6 text-center text-ink-3 text-[12.5px]">
              Nenhuma comanda aberta para adicionar um serviço — só é possível adicionar serviço a uma comanda já existente.
            </div>
          ) : (
            <>
              <div className="px-5 py-3 border-b border-line shrink-0">
                <select
                  aria-label="Profissional do serviço"
                  value={selectedProfessionalId}
                  onChange={e => { setSelectedProfessionalId(e.target.value); setServiceSearch('') }}
                  className={inputClsAddProd}
                >
                  <option value="">Escolha a profissional...</option>
                  {professionals.map(p => (
                    <option key={p.UUID} value={p.UUID}>{p.Name}</option>
                  ))}
                </select>
              </div>
              {!selectedProfessionalId ? (
                <div className="px-5 py-6 text-center text-ink-3 text-[12.5px]">Escolha uma profissional pra ver os serviços que ela atende</div>
              ) : (
                <>
                  <div className="px-5 py-3 border-b border-line shrink-0">
                    <input
                      value={serviceSearch}
                      onChange={e => setServiceSearch(e.target.value)}
                      placeholder="Buscar serviço..."
                      className={inputClsAddProd}
                    />
                  </div>
                  <div className="overflow-y-auto flex-1 min-h-0 scrollbar-hidden max-h-[320px] md:max-h-none">
                    {loadingProfServices ? (
                      <div className="px-5 py-6 text-center text-ink-3 text-[12.5px]">Carregando...</div>
                    ) : filteredServices.length === 0 ? (
                      <div className="px-5 py-6 text-center text-ink-3 text-[12.5px]">Essa profissional não atende nenhum serviço</div>
                    ) : filteredServices.map(s => (
                      <div key={s.UUID} className="flex items-center justify-between gap-2 px-5 py-2.5 border-b border-line-2 last:border-0">
                        <div className="text-[12.5px] font-medium truncate">{s.Name}</div>
                        <button
                          onClick={() => handleAddService(s)}
                          disabled={addingServiceId === s.UUID}
                          title="Adicionar à conta"
                          className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full bg-brand text-white hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer">
                          <Icon name="plus" size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
        </div>
      </div>

      <Modal
        isOpen={!!conflictModal}
        onClose={() => setConflictModal(null)}
        onConfirm={handleConfirmOverlap}
        title="Conflito de horário"
        message={`${conflictModal?.message ?? ''} Deseja lançar mesmo assim?`}
        confirmLabel="Lançar mesmo assim"
        loading={confirmingOverlap}
      />
    </div>
  )
}
